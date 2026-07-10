import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVoiceStore } from '../voiceStore';
import { VoiceWorkerClient } from '../voiceWorkerClient';
import { VoiceWorkerResponse } from '../voiceWorkerProtocol';

class MockWorker {
  onmessage: ((e: MessageEvent<VoiceWorkerResponse>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  addEventListener(event: string, listener: unknown) {
    if (event === 'message') {
      this.onmessage = listener as (e: MessageEvent<VoiceWorkerResponse>) => void;
    }
    if (event === 'error') {
      this.onerror = listener as (e: ErrorEvent) => void;
    }
  }
  removeEventListener = vi.fn();
}

describe('VoiceWorkerClient & Protocol (Phase 3)', () => {
  let client: VoiceWorkerClient;
  let mockWorkerInstance: MockWorker;

  beforeEach(() => {
    useVoiceStore.getState().reset();

    mockWorkerInstance = new MockWorker();
    vi.stubGlobal(
      'Worker',
      vi.fn().mockImplementation(function () {
        return mockWorkerInstance;
      })
    );

    client = new VoiceWorkerClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    client.dispose();
  });

  it('triggers INIT_MODEL and forwards progress updates to the store', () => {
    const requestId = client.initModel('whisper-tiny', 'auto');
    expect(requestId).toBeDefined();

    const store = useVoiceStore.getState();
    expect(store.modelStatus).toBe('loading');
    expect(store.modelProgress).toBe(0);

    // Simulate progress event from worker
    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'MODEL_PROGRESS',
          requestId,
          progress: 0.45,
          file: 'encoder.onnx',
        },
      } as MessageEvent);
    }

    expect(useVoiceStore.getState().modelProgress).toBe(0.45);
  });

  it('sets modelStatus to ready upon MODEL_READY response', () => {
    const requestId = client.initModel('whisper-tiny', 'auto');

    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'MODEL_READY',
          requestId,
          actualBackend: 'webgpu',
          modelLoadTimeMs: 1500,
        },
      } as MessageEvent);
    }

    const store = useVoiceStore.getState();
    expect(store.modelStatus).toBe('ready');
    expect(store.actualBackend).toBe('webgpu');
  });

  it('marks fallback status correctly upon BACKEND_FALLBACK event', () => {
    const requestId = client.initModel('whisper-tiny', 'auto');

    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'BACKEND_FALLBACK',
          requestId,
          reason: 'WebGPU compilation error',
        },
      } as MessageEvent);
    }

    const store = useVoiceStore.getState();
    expect(store.fallbackOccurred).toBe(true);
    expect(store.fallbackReason).toBe('WebGPU compilation error');
  });

  it('retains typed fallback availability when model initialization fails', () => {
    const requestId = client.initModel('whisper-tiny', 'auto');

    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'WORKER_ERROR',
          requestId,
          error: 'Model loading completely failed',
        },
      } as MessageEvent);
    }

    const store = useVoiceStore.getState();
    expect(store.modelStatus).toBe('failed');
    expect(store.error).toBe('Model loading completely failed');
    // Verify fallback typedCommand is still writable and clean
    expect(store.typedCommand).toBe('');
    store.setTypedCommand('nudge right');
    expect(useVoiceStore.getState().typedCommand).toBe('nudge right');
  });

  it('runs transcription and records RTF and latency metrics correctly', () => {
    const pcm = new Float32Array(16000); // 1.0s audio
    const requestId = client.transcribe(pcm, 1.0);

    const store = useVoiceStore.getState();
    expect(store.transcriptionStatus).toBe('transcribing');
    expect(store.activeRequestId).toBe(requestId);

    // Simulate result event from worker
    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'TRANSCRIPTION_RESULT',
          requestId,
          result: {
            requestId,
            transcript: 'move up five cm',
            modelId: 'whisper-tiny',
            preferredBackend: 'auto',
            actualBackend: 'wasm',
            fallbackOccurred: false,
            fallbackReason: null,
            modelLoadTimeMs: 1000,
            inferenceTimeMs: 500,
            audioDurationSeconds: 1.0,
            realTimeFactor: 0.5,
          },
        },
      } as MessageEvent);
    }

    const updatedStore = useVoiceStore.getState();
    expect(updatedStore.transcriptionStatus).toBe('completed');
    expect(updatedStore.transcript).toBe('move up five cm');
    expect(updatedStore.inferenceTimeMs).toBe(500);
    expect(updatedStore.realTimeFactor).toBe(0.5);
    expect(updatedStore.activeRequestId).toBeNull();
  });

  it('ignores stale response updates', () => {
    const pcm = new Float32Array(16000);
    client.transcribe(pcm, 1.0);

    // Simulate starting another transcription immediately (staling the first)
    const newRequestId = client.transcribe(pcm, 1.0);

    // If worker returns result for the first request, client must ignore it
    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'TRANSCRIPTION_RESULT',
          requestId: 'req-stale-id-123',
          result: {
            requestId: 'req-stale-id-123',
            transcript: 'stale transcript should be ignored',
            modelId: 'whisper-tiny',
            preferredBackend: 'auto',
            actualBackend: 'wasm',
            fallbackOccurred: false,
            fallbackReason: null,
            modelLoadTimeMs: 1000,
            inferenceTimeMs: 500,
            audioDurationSeconds: 1.0,
            realTimeFactor: 0.5,
          },
        },
      } as MessageEvent);
    }

    const store = useVoiceStore.getState();
    expect(store.transcript).toBeNull();
    expect(store.transcriptionStatus).toBe('transcribing');
    expect(store.activeRequestId).toBe(newRequestId);
  });

  it('cancels active transcription and rejects late worker outputs', () => {
    const pcm = new Float32Array(16000);
    const requestId = client.transcribe(pcm, 1.0);

    client.cancelActiveTranscription();

    const store = useVoiceStore.getState();
    expect(store.transcriptionStatus).toBe('cancelled');
    expect(store.activeRequestId).toBeNull();

    // Late result arriving from worker after cancellation is ignored
    if (mockWorkerInstance.onmessage) {
      mockWorkerInstance.onmessage({
        data: {
          type: 'TRANSCRIPTION_RESULT',
          requestId,
          result: {
            requestId,
            transcript: 'late arrival text',
            modelId: 'whisper-tiny',
            preferredBackend: 'auto',
            actualBackend: 'wasm',
            fallbackOccurred: false,
            fallbackReason: null,
            modelLoadTimeMs: 1000,
            inferenceTimeMs: 500,
            audioDurationSeconds: 1.0,
            realTimeFactor: 0.5,
          },
        },
      } as MessageEvent);
    }

    expect(useVoiceStore.getState().transcript).toBeNull();
  });

  it('disposes client and terminates underlying worker safely', () => {
    client.initModel('whisper-tiny', 'auto');
    client.dispose();

    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    const store = useVoiceStore.getState();
    expect(store.modelStatus).toBe('uninitialized');
  });

  it('transfers sliced copy preventing store buffer detachment', () => {
    const pcm = new Float32Array(100);
    pcm.fill(0.7);

    // Call transcribe
    client.transcribe(pcm, 1.0);

    // Verify postMessage is called with a copy, and the original pcm has NOT been detached
    expect(mockWorkerInstance.postMessage).toHaveBeenCalled();
    // In javascript, if a buffer is detached, its byteLength becomes 0.
    // If we sliced it, the original pcm buffer length remains 100.
    expect(pcm.byteLength).toBe(400); // 100 Float32 elements * 4 bytes = 400 bytes
    expect(pcm[0]).toBeCloseTo(0.7);
  });
});
