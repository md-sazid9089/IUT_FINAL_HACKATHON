import { create } from 'zustand';
import { checkBrowserSupport, type VoiceBrowserSupport } from './browserSupport';

export type RecordingStatus =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'stopping'
  | 'ready'
  | 'cancelled'
  | 'error';

export type AudioProcessingStatus = 'idle' | 'processing' | 'ready' | 'error';

export type VoiceModelStatus =
  | 'uninitialized'
  | 'loading'
  | 'initializing'
  | 'falling-back'
  | 'ready'
  | 'failed';

export type TranscriptionStatus = 'idle' | 'transcribing' | 'completed' | 'cancelled' | 'error';

export interface ProcessedVoiceAudio {
  pcm: Float32Array;
  sampleRate: 16000;

  originalDurationSeconds: number;
  processedDurationSeconds: number;

  originalSampleRate: number;
  originalChannelCount: number;
  outputChannelCount: 1;

  originalPeakAmplitude: number;
  originalRmsAmplitude: number;

  processedPeakAmplitude: number;
  processedRmsAmplitude: number;

  trimmed: boolean;
  leadingTrimSamples: number;
  trailingTrimSamples: number;
  trimPaddingSamples: number;
}

export type VoiceAudioErrorCode =
  | 'EMPTY_BLOB'
  | 'DECODE_FAILED'
  | 'EMPTY_AUDIO_BUFFER'
  | 'INVALID_CHANNEL_DATA'
  | 'INVALID_SAMPLE_RATE'
  | 'NON_FINITE_PCM'
  | 'SILENT_AUDIO'
  | 'AUDIO_TOO_SHORT'
  | 'AUDIO_TOO_LONG'
  | 'AUDIO_CONTEXT_UNAVAILABLE'
  | 'RESAMPLE_FAILED';

export interface VoiceStoreState {
  recordingStatus: RecordingStatus;
  audioProcessingStatus: AudioProcessingStatus;
  modelStatus: VoiceModelStatus;
  transcriptionStatus: TranscriptionStatus;

  elapsedMs: number;
  recordedBlob: Blob | null;
  processedAudio: ProcessedVoiceAudio | null;
  audioProcessingError: string | null;

  modelProgress: number;
  modelError: string | null;
  preferredBackend: 'auto' | 'webgpu' | 'wasm';
  actualBackend: 'webgpu' | 'wasm' | null;
  fallbackOccurred: boolean;
  fallbackReason: string | null;

  transcript: string | null;
  inferenceTimeMs: number | null;
  realTimeFactor: number | null;
  activeRequestId: string | null;

  browserSupport: VoiceBrowserSupport;
  typedCommand: string;
  error: string | null;

  // Actions
  setRecordingStatus: (status: RecordingStatus) => void;
  setAudioProcessingStatus: (status: AudioProcessingStatus) => void;
  setModelStatus: (status: VoiceModelStatus) => void;
  setTranscriptionStatus: (status: TranscriptionStatus) => void;
  setElapsedMs: (elapsedMs: number) => void;
  setRecordedBlob: (recordedBlob: Blob | null) => void;
  setProcessedAudio: (processedAudio: ProcessedVoiceAudio | null) => void;
  setAudioProcessingError: (error: string | null) => void;
  setModelProgress: (progress: number) => void;
  setModelError: (error: string | null) => void;
  setPreferredBackend: (backend: 'auto' | 'webgpu' | 'wasm') => void;
  setActualBackend: (backend: 'webgpu' | 'wasm' | null) => void;
  setFallbackOccurred: (occurred: boolean) => void;
  setFallbackReason: (reason: string | null) => void;
  setTranscript: (transcript: string | null) => void;
  setInferenceTimeMs: (ms: number | null) => void;
  setRealTimeFactor: (rtf: number | null) => void;
  setActiveRequestId: (id: string | null) => void;
  setTypedCommand: (command: string) => void;
  setBrowserSupport: (support: VoiceBrowserSupport) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  recordingStatus: 'idle',
  audioProcessingStatus: 'idle',
  modelStatus: 'uninitialized',
  transcriptionStatus: 'idle',

  elapsedMs: 0,
  recordedBlob: null,
  processedAudio: null,
  audioProcessingError: null,

  modelProgress: 0,
  modelError: null,
  preferredBackend: 'auto',
  actualBackend: null,
  fallbackOccurred: false,
  fallbackReason: null,

  transcript: null,
  inferenceTimeMs: null,
  realTimeFactor: null,
  activeRequestId: null,

  browserSupport: checkBrowserSupport(),
  typedCommand: '',
  error: null,

  setRecordingStatus: (recordingStatus) => set({ recordingStatus }),
  setAudioProcessingStatus: (audioProcessingStatus) => set({ audioProcessingStatus }),
  setModelStatus: (modelStatus) => set({ modelStatus }),
  setTranscriptionStatus: (transcriptionStatus) => set({ transcriptionStatus }),
  setElapsedMs: (elapsedMs) => set({ elapsedMs }),
  setRecordedBlob: (recordedBlob) => set({ recordedBlob }),
  setProcessedAudio: (processedAudio) => set({ processedAudio }),
  setAudioProcessingError: (audioProcessingError) => set({ audioProcessingError }),
  setModelProgress: (modelProgress) => set({ modelProgress }),
  setModelError: (modelError) => set({ modelError }),
  setPreferredBackend: (preferredBackend) => set({ preferredBackend }),
  setActualBackend: (actualBackend) => set({ actualBackend }),
  setFallbackOccurred: (fallbackOccurred) => set({ fallbackOccurred }),
  setFallbackReason: (fallbackReason) => set({ fallbackReason }),
  setTranscript: (transcript) => set({ transcript }),
  setInferenceTimeMs: (inferenceTimeMs) => set({ inferenceTimeMs }),
  setRealTimeFactor: (realTimeFactor) => set({ realTimeFactor }),
  setActiveRequestId: (activeRequestId) => set({ activeRequestId }),
  setTypedCommand: (typedCommand) => set({ typedCommand }),
  setBrowserSupport: (browserSupport) => set({ browserSupport }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      recordingStatus: 'idle',
      audioProcessingStatus: 'idle',
      modelStatus: 'uninitialized',
      transcriptionStatus: 'idle',
      elapsedMs: 0,
      recordedBlob: null,
      processedAudio: null,
      audioProcessingError: null,
      modelProgress: 0,
      modelError: null,
      preferredBackend: 'auto',
      actualBackend: null,
      fallbackOccurred: false,
      fallbackReason: null,
      transcript: null,
      inferenceTimeMs: null,
      realTimeFactor: null,
      activeRequestId: null,
      browserSupport: checkBrowserSupport(),
      error: null,
    }),
}));
