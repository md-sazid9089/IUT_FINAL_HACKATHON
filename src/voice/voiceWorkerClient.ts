import { useVoiceStore } from './voiceStore';
import { VoiceWorkerRequest, VoiceWorkerResponse } from './voiceWorkerProtocol';

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class VoiceWorkerClient {
  private worker: Worker | null = null;
  private currentInitRequestId: string | null = null;
  private currentTranscribeRequestId: string | null = null;

  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /** Lazy worker initialization. */
  private getWorker(): Worker {
    if (!this.worker) {
      // Instantiate standard module worker
      this.worker = new Worker(
        new URL('./voice.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.addEventListener('message', this.handleMessage);
      this.worker.addEventListener('error', this.handleError);
    }
    return this.worker;
  }

  initModel(modelId: string, preferredBackend: 'auto' | 'webgpu' | 'wasm' = 'auto'): string {
    const requestId = generateRequestId();
    this.currentInitRequestId = requestId;

    const store = useVoiceStore.getState();
    store.setModelStatus('loading');
    store.setModelProgress(0);
    store.setModelError(null);
    store.setFallbackOccurred(false);
    store.setFallbackReason(null);

    const request: VoiceWorkerRequest = {
      type: 'INIT_MODEL',
      requestId,
      modelId,
      preferredBackend,
    };

    this.getWorker().postMessage(request);
    return requestId;
  }

  transcribe(pcm: Float32Array, durationSeconds: number): string {
    const requestId = generateRequestId();
    this.currentTranscribeRequestId = requestId;

    const store = useVoiceStore.getState();
    store.setTranscriptionStatus('transcribing');
    store.setTranscript(null);
    store.setError(null);
    store.setActiveRequestId(requestId);

    // Slice Float32Array to transfer an independent buffer and prevent store data loss
    const transferablePcm = pcm.slice();

    const request: VoiceWorkerRequest = {
      type: 'TRANSCRIBE_AUDIO',
      requestId,
      pcm: transferablePcm,
      sampleRate: 16000,
      audioDurationSeconds: durationSeconds,
    };

    this.getWorker().postMessage(request, [transferablePcm.buffer]);
    return requestId;
  }

  cancelActiveTranscription(): void {
    const store = useVoiceStore.getState();
    const requestId = this.currentTranscribeRequestId;
    if (!requestId || store.transcriptionStatus !== 'transcribing') {
      return;
    }

    const request: VoiceWorkerRequest = {
      type: 'CANCEL_REQUEST',
      requestId,
    };

    if (this.worker) {
      this.worker.postMessage(request);
    }

    store.setTranscriptionStatus('cancelled');
    store.setActiveRequestId(null);
    this.currentTranscribeRequestId = null;
  }

  dispose(): void {
    const requestId = generateRequestId();
    const request: VoiceWorkerRequest = {
      type: 'DISPOSE',
      requestId,
    };

    if (this.worker) {
      try {
        this.worker.postMessage(request);
        this.worker.removeEventListener('message', this.handleMessage);
        this.worker.removeEventListener('error', this.handleError);
        this.worker.terminate();
      } catch {
        // ignore errors on quick shutdown
      }
    }

    this.worker = null;
    this.currentInitRequestId = null;
    this.currentTranscribeRequestId = null;

    const store = useVoiceStore.getState();
    store.setTranscriptionStatus('idle');
    store.setModelStatus('uninitialized');
    store.setActiveRequestId(null);
  }

  private handleMessage(e: MessageEvent<VoiceWorkerResponse>): void {
    const response = e.data;
    if (!response || !response.type) {
      return;
    }

    const store = useVoiceStore.getState();
    const { type, requestId } = response;

    // Filter stale initialization responses
    if (
      (type.startsWith('MODEL_') || type === 'BACKEND_FALLBACK') &&
      this.currentInitRequestId !== requestId
    ) {
      return;
    }

    // Filter stale transcription responses
    if (
      type.startsWith('TRANSCRIPTION_') &&
      this.currentTranscribeRequestId !== requestId
    ) {
      return;
    }

    switch (type) {
      case 'MODEL_LOADING':
        store.setModelStatus('loading');
        if (response.payload && typeof response.payload.progress === 'number') {
          store.setModelProgress(response.payload.progress);
        }
        break;

      case 'MODEL_PROGRESS':
        store.setModelStatus('loading');
        store.setModelProgress(response.progress);
        break;

      case 'MODEL_INITIALIZING':
        store.setModelStatus('initializing');
        break;

      case 'MODEL_READY':
        store.setModelStatus('ready');
        store.setActualBackend(response.actualBackend);
        this.currentInitRequestId = null;
        break;

      case 'BACKEND_FALLBACK':
        store.setFallbackOccurred(true);
        store.setFallbackReason(response.reason);
        store.setModelStatus('falling-back');
        break;

      case 'TRANSCRIPTION_STARTED':
        store.setTranscriptionStatus('transcribing');
        break;

      case 'TRANSCRIPTION_RESULT':
        store.setTranscriptionStatus('completed');
        store.setTranscript(response.result.transcript);
        store.setInferenceTimeMs(response.result.inferenceTimeMs);
        store.setRealTimeFactor(response.result.realTimeFactor);
        store.setActualBackend(response.result.actualBackend);
        store.setFallbackOccurred(response.result.fallbackOccurred);
        store.setFallbackReason(response.result.fallbackReason);
        store.setActiveRequestId(null);
        this.currentTranscribeRequestId = null;
        break;

      case 'TRANSCRIPTION_ERROR':
        store.setTranscriptionStatus('error');
        store.setError(response.error);
        store.setActiveRequestId(null);
        this.currentTranscribeRequestId = null;
        break;

      case 'REQUEST_CANCELLED':
        store.setTranscriptionStatus('cancelled');
        store.setActiveRequestId(null);
        this.currentTranscribeRequestId = null;
        break;

      case 'WORKER_ERROR':
        store.setModelStatus('failed');
        store.setModelError(response.error);
        store.setError(response.error);
        this.currentInitRequestId = null;
        break;

      case 'DISPOSED':
        store.setModelStatus('uninitialized');
        break;

      default:
        break;
    }
  }

  private handleError(e: ErrorEvent): void {
    const store = useVoiceStore.getState();
    const errorMsg = e.message || 'Voice worker crashed unexpectedly.';
    store.setModelStatus('failed');
    store.setTranscriptionStatus('error');
    store.setError(errorMsg);
    store.setModelError(errorMsg);
  }
}
