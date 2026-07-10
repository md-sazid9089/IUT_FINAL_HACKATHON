import { pipeline, env } from '@huggingface/transformers';
import { VoiceWorkerRequest, VoiceWorkerResponse } from './voiceWorkerProtocol';

// Configure transformers environment variables
env.allowLocalModels = false; // Retrieve weights from HF Hub directly

type ASRPipelineType = (
  pcm: Float32Array,
  options: {
    chunk_length_s?: number;
    stride_length_s?: number;
    return_timestamps?: boolean;
  }
) => Promise<{ text: string } | Array<{ text: string }>>;

let asrPipeline: ASRPipelineType | null = null;
let currentModelId = '';
let currentBackend: 'webgpu' | 'wasm' | null = null;
let modelLoadTimeMs: number | null = null;
const cancelledRequestIds = new Set<string>();
let activeRequestId: string | null = null;

function hasWorkerWebGpuSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    navigator.gpu != null
  );
}

self.onmessage = async (e: MessageEvent<VoiceWorkerRequest>) => {
  const request = e.data;
  if (!request || !request.requestId) {
    return;
  }

  const { type, requestId } = request;

  switch (type) {
    case 'INIT_MODEL': {
      activeRequestId = requestId;
      const { modelId, preferredBackend } = request;
      const startTime = performance.now();

      const progressCallback = (data: { status: string; progress?: number; file?: string }) => {
        if (data.status === 'progress' && typeof data.progress === 'number') {
          const response: VoiceWorkerResponse = {
            type: 'MODEL_PROGRESS',
            requestId,
            progress: data.progress,
            file: data.file,
          };
          self.postMessage(response);
        } else if (data.status === 'downloading') {
          const response: VoiceWorkerResponse = {
            type: 'MODEL_LOADING',
            requestId,
            payload: {
              status: 'downloading',
              file: data.file || 'weights.onnx',
              progress: data.progress,
            },
          };
          self.postMessage(response);
        }
      };

      const useWebGPU =
        preferredBackend === 'webgpu' ||
        (preferredBackend === 'auto' && hasWorkerWebGpuSupport());

      if (useWebGPU) {
        try {
          const responseInit: VoiceWorkerResponse = {
            type: 'MODEL_INITIALIZING',
            requestId,
            backend: 'webgpu',
          };
          self.postMessage(responseInit);

          asrPipeline = (await pipeline(
            'automatic-speech-recognition',
            modelId,
            {
              device: 'webgpu',
              progress_callback: progressCallback,
            }
          )) as ASRPipelineType;
          currentBackend = 'webgpu';
          currentModelId = modelId;
          modelLoadTimeMs = performance.now() - startTime;

          const responseReady: VoiceWorkerResponse = {
            type: 'MODEL_READY',
            requestId,
            actualBackend: 'webgpu',
            modelLoadTimeMs,
          };
          self.postMessage(responseReady);
          activeRequestId = null;
          return;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'WebGPU pipeline failed to load';
          const responseFallback: VoiceWorkerResponse = {
            type: 'BACKEND_FALLBACK',
            requestId,
            reason: `${errMsg}. Falling back to WASM.`,
          };
          self.postMessage(responseFallback);
        }
      }

      // WASM Fallback path
      try {
        const responseInitWasm: VoiceWorkerResponse = {
          type: 'MODEL_INITIALIZING',
          requestId,
          backend: 'wasm',
        };
        self.postMessage(responseInitWasm);

        asrPipeline = (await pipeline(
          'automatic-speech-recognition',
          modelId,
          {
            device: 'wasm',
            progress_callback: progressCallback,
          }
        )) as ASRPipelineType;
        currentBackend = 'wasm';
        currentModelId = modelId;
        modelLoadTimeMs = performance.now() - startTime;

        const responseReadyWasm: VoiceWorkerResponse = {
          type: 'MODEL_READY',
          requestId,
          actualBackend: 'wasm',
          modelLoadTimeMs: modelLoadTimeMs || 0,
        };
        self.postMessage(responseReadyWasm);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'ASR model failed to initialize on both backends.';
        const responseError: VoiceWorkerResponse = {
          type: 'WORKER_ERROR',
          requestId,
          error: errMsg,
        };
        self.postMessage(responseError);
      }
      activeRequestId = null;
      break;
    }

    case 'TRANSCRIBE_AUDIO': {
      activeRequestId = requestId;
      const { pcm, sampleRate, audioDurationSeconds } = request;

      try {
        if (!(pcm instanceof Float32Array) || pcm.length === 0) {
          throw new Error('PCM payload is empty or not Float32Array.');
        }
        if (sampleRate !== 16000) {
          throw new Error('ASR model input must be exactly 16000 Hz.');
        }
        if (audioDurationSeconds > 5.0) {
          throw new Error('Audio duration exceeds maximum 5.0 seconds.');
        }
        if (!asrPipeline) {
          throw new Error('ASR pipeline is uninitialized. Call INIT_MODEL first.');
        }

        const startedMsg: VoiceWorkerResponse = {
          type: 'TRANSCRIPTION_STARTED',
          requestId,
        };
        self.postMessage(startedMsg);

        const startTime = performance.now();

        // Run local model inference
        const result = await asrPipeline(pcm, {
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: false,
        });

        const inferenceTimeMs = performance.now() - startTime;

        if (cancelledRequestIds.has(requestId)) {
          cancelledRequestIds.delete(requestId);
          const responseCancelled: VoiceWorkerResponse = {
            type: 'REQUEST_CANCELLED',
            requestId,
          };
          self.postMessage(responseCancelled);
          activeRequestId = null;
          return;
        }

        const rawText = Array.isArray(result) ? result[0]?.text : result?.text;
        if (typeof rawText !== 'string') {
          throw new Error('Model failed to transcribe audio payload.');
        }

        const transcript = rawText.trim();
        if (transcript.length === 0) {
          throw new Error('ASR result transcript is empty.');
        }

        const rtf = (inferenceTimeMs / 1000) / audioDurationSeconds;

        const responseResult: VoiceWorkerResponse = {
          type: 'TRANSCRIPTION_RESULT',
          requestId,
          result: {
            requestId,
            transcript,
            modelId: currentModelId,
            preferredBackend: 'auto',
            actualBackend: currentBackend || 'wasm',
            fallbackOccurred: currentBackend === 'wasm' && hasWorkerWebGpuSupport(),
            fallbackReason: currentBackend === 'wasm' ? 'WebGPU failed or was bypassed' : null,
            modelLoadTimeMs,
            inferenceTimeMs,
            audioDurationSeconds,
            realTimeFactor: rtf,
          },
        };
        self.postMessage(responseResult);

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'ASR transcription failed.';
        if (cancelledRequestIds.has(requestId)) {
          cancelledRequestIds.delete(requestId);
          const responseCancelled: VoiceWorkerResponse = {
            type: 'REQUEST_CANCELLED',
            requestId,
          };
          self.postMessage(responseCancelled);
        } else {
          const responseError: VoiceWorkerResponse = {
            type: 'TRANSCRIPTION_ERROR',
            requestId,
            error: errMsg,
          };
          self.postMessage(responseError);
        }
      }
      activeRequestId = null;
      break;
    }

    case 'CANCEL_REQUEST': {
      cancelledRequestIds.add(requestId);
      if (activeRequestId === requestId) {
        activeRequestId = null;
      }
      const response: VoiceWorkerResponse = {
        type: 'REQUEST_CANCELLED',
        requestId,
      };
      self.postMessage(response);
      break;
    }

    case 'GET_STATUS': {
      const response: VoiceWorkerResponse = {
        type: 'WORKER_STATUS',
        requestId,
        status: asrPipeline ? 'ready' : 'uninitialized',
        activeRequestId,
      };
      self.postMessage(response);
      break;
    }

    case 'DISPOSE': {
      asrPipeline = null;
      currentModelId = '';
      currentBackend = null;
      modelLoadTimeMs = null;
      cancelledRequestIds.clear();
      activeRequestId = null;

      const response: VoiceWorkerResponse = {
        type: 'DISPOSED',
        requestId,
      };
      self.postMessage(response);
      break;
    }

    default: {
      const response: VoiceWorkerResponse = {
        type: 'WORKER_ERROR',
        requestId,
        error: `Unknown request type: ${(request as unknown as { type?: string }).type}`,
      };
      self.postMessage(response);
      break;
    }
  }
};
