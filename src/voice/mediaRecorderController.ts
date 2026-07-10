import { useVoiceStore } from './voiceStore';
import { MAX_RECORDING_DURATION_MS, TIMER_TICK_MS, MIN_VALID_RECORDING_MS } from './voiceConfig';

export class MediaRecorderController {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isCancelled = false;
  private startTime = 0;
  private chunks: Blob[] = [];

  constructor() {
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.cancel = this.cancel.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  async start(): Promise<void> {
    const store = useVoiceStore.getState();
    if (store.recordingStatus === 'listening' || store.recordingStatus === 'requesting-permission') {
      return;
    }

    // Reset store before starting
    store.setError(null);
    store.setRecordedBlob(null);
    store.setProcessedAudio(null);
    store.setAudioProcessingError(null);
    store.setAudioProcessingStatus('idle');
    store.setTranscriptionStatus('idle');
    store.setTranscript(null);
    store.setElapsedMs(0);
    store.setRecordingStatus('requesting-permission');

    this.isCancelled = false;
    this.chunks = [];

    if (!store.browserSupport.supported) {
      this.handleError(new Error(store.browserSupport.reason ?? 'Browser not supported'));
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (this.isCancelled) {
        this.releaseTracks();
        return;
      }

      store.setRecordingStatus('listening');
      this.mediaRecorder = new window.MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.releaseTracks();
        this.clearTimers();

        if (this.isCancelled) {
          useVoiceStore.getState().setRecordingStatus('cancelled');
          return;
        }

        const duration = Date.now() - this.startTime;
        if (duration < MIN_VALID_RECORDING_MS || this.chunks.length === 0) {
          useVoiceStore.getState().setError('Recording was too short or empty.');
          useVoiceStore.getState().setRecordingStatus('error');
          return;
        }

        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        useVoiceStore.getState().setRecordedBlob(blob);
        useVoiceStore.getState().setRecordingStatus('ready');
      };

      this.mediaRecorder.onerror = (e: Event) => {
        const errEvent = e as unknown as { error?: Error };
        this.handleError(errEvent.error || new Error('MediaRecorder error'));
      };

      this.startTime = Date.now();
      this.mediaRecorder.start();

      this.intervalId = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        useVoiceStore.getState().setElapsedMs(Math.min(elapsed, MAX_RECORDING_DURATION_MS));
        if (elapsed >= MAX_RECORDING_DURATION_MS) {
          this.stop();
        }
      }, TIMER_TICK_MS);

      this.timeoutId = setTimeout(() => {
        this.stop();
      }, MAX_RECORDING_DURATION_MS + 200);

    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  stop(): void {
    const store = useVoiceStore.getState();
    if (store.recordingStatus !== 'listening') {
      return;
    }

    store.setRecordingStatus('stopping');
    this.clearTimers();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Prevent crashes if duplicate stop is triggered
      }
    } else {
      this.releaseTracks();
      store.setRecordingStatus('idle');
    }
  }

  cancel(reason: string = 'cancelled'): void {
    const store = useVoiceStore.getState();
    if (
      store.recordingStatus === 'idle' ||
      store.recordingStatus === 'ready' ||
      store.recordingStatus === 'error' ||
      store.recordingStatus === 'cancelled'
    ) {
      return;
    }

    this.isCancelled = true;
    this.clearTimers();
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    } else {
      this.releaseTracks();
      store.setRecordingStatus('cancelled');
    }

    store.setRecordedBlob(null);
    if (reason !== 'cancelled') {
      store.setError(reason);
      store.setRecordingStatus('error');
    } else {
      store.setRecordingStatus('cancelled');
    }
  }

  cleanup(): void {
    this.isCancelled = true;
    this.clearTimers();
    this.releaseTracks();
    this.mediaRecorder = null;
    this.stream = null;
  }

  private clearTimers(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private releaseTracks(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
    }
  }

  private handleError(err: unknown): void {
    this.clearTimers();
    this.releaseTracks();

    let message = 'An error occurred while accessing the microphone.';
    if (err instanceof Error || (err && typeof err === 'object' && 'name' in err)) {
      const errorObj = err as { name: string; message?: string };
      switch (errorObj.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          message = 'Microphone permission was denied. You can still use the typed command field.';
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          message = 'No microphone was found on this device.';
          break;
        case 'NotReadableError':
          message = 'Microphone is busy or unavailable. It might be used by another application.';
          break;
        case 'SecurityError':
          message = 'Microphone access requires a secure context (HTTPS/localhost).';
          break;
        case 'AbortError':
          message = 'Microphone access request was aborted.';
          break;
        default:
          if (errorObj.message) {
            message = `Microphone error: ${errorObj.message}`;
          }
          break;
      }
    }

    const store = useVoiceStore.getState();
    store.setError(message);
    store.setRecordingStatus('error');
  }
}
