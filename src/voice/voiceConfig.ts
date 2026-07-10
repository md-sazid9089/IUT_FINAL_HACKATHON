export const MAX_RECORDING_DURATION_MS = 5000;
export const TIMER_TICK_MS = 100;
export const MIN_VALID_RECORDING_MS = 200;
export const VOICE_SETTINGS_VERSION = 'gate7-voice-v2';

export const VOICE_AUDIO_CONFIG = {
  targetSampleRate: 16000,
  minProcessedAudioMs: 300,
  maxProcessedAudioMs: 5000,
  silenceAmplitudeThreshold: 0.008,
  minimumRmsThreshold: 0.002,
  trimPaddingMs: 80,
  maxAbsoluteSample: 1.0,
} as const;

export const VOICE_MODEL_CONFIG = {
  modelId: 'Xenova/whisper-tiny.en',
  task: 'automatic-speech-recognition',
  preferredBackend: 'auto',
} as const;
