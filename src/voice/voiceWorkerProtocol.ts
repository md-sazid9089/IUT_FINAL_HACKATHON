export type WorkerRequestType =
  | 'INIT_MODEL'
  | 'TRANSCRIBE_AUDIO'
  | 'CANCEL_REQUEST'
  | 'GET_STATUS'
  | 'DISPOSE';

export type WorkerResponseType =
  | 'MODEL_LOADING'
  | 'MODEL_PROGRESS'
  | 'MODEL_INITIALIZING'
  | 'MODEL_READY'
  | 'BACKEND_FALLBACK'
  | 'TRANSCRIPTION_STARTED'
  | 'TRANSCRIPTION_RESULT'
  | 'TRANSCRIPTION_ERROR'
  | 'REQUEST_CANCELLED'
  | 'WORKER_STATUS'
  | 'WORKER_ERROR'
  | 'DISPOSED';

export type VoiceWorkerRequest =
  | {
      type: 'INIT_MODEL';
      requestId: string;
      modelId: string;
      preferredBackend: 'auto' | 'webgpu' | 'wasm';
    }
  | {
      type: 'TRANSCRIBE_AUDIO';
      requestId: string;
      pcm: Float32Array;
      sampleRate: 16000;
      audioDurationSeconds: number;
    }
  | {
      type: 'CANCEL_REQUEST';
      requestId: string;
    }
  | {
      type: 'GET_STATUS';
      requestId: string;
    }
  | {
      type: 'DISPOSE';
      requestId: string;
    };

export interface ModelProgressPayload {
  status: 'downloading' | 'done' | 'progress';
  file: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface VoiceTranscriptionResult {
  requestId: string;
  transcript: string;
  modelId: string;
  preferredBackend: 'auto' | 'webgpu' | 'wasm';
  actualBackend: 'webgpu' | 'wasm';
  fallbackOccurred: boolean;
  fallbackReason: string | null;
  modelLoadTimeMs: number | null;
  inferenceTimeMs: number;
  audioDurationSeconds: number;
  realTimeFactor: number;
}

export type VoiceWorkerResponse =
  | {
      type: 'MODEL_LOADING';
      requestId: string;
      payload: ModelProgressPayload;
    }
  | {
      type: 'MODEL_PROGRESS';
      requestId: string;
      progress: number;
      file?: string;
    }
  | {
      type: 'MODEL_INITIALIZING';
      requestId: string;
      backend: 'webgpu' | 'wasm';
    }
  | {
      type: 'MODEL_READY';
      requestId: string;
      actualBackend: 'webgpu' | 'wasm';
      modelLoadTimeMs: number;
    }
  | {
      type: 'BACKEND_FALLBACK';
      requestId: string;
      reason: string;
    }
  | {
      type: 'TRANSCRIPTION_STARTED';
      requestId: string;
    }
  | {
      type: 'TRANSCRIPTION_RESULT';
      requestId: string;
      result: VoiceTranscriptionResult;
    }
  | {
      type: 'TRANSCRIPTION_ERROR';
      requestId: string;
      error: string;
    }
  | {
      type: 'REQUEST_CANCELLED';
      requestId: string;
    }
  | {
      type: 'WORKER_STATUS';
      requestId: string;
      status: string;
      activeRequestId: string | null;
    }
  | {
      type: 'WORKER_ERROR';
      requestId: string;
      error: string;
    }
  | {
      type: 'DISPOSED';
      requestId: string;
    };
