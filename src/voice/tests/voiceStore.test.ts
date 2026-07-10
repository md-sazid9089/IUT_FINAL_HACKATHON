import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from '../voiceStore';

describe('useVoiceStore', () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
  });

  it('should initialize with correct default values', () => {
    const state = useVoiceStore.getState();
    expect(state.recordingStatus).toBe('idle');
    expect(state.audioProcessingStatus).toBe('idle');
    expect(state.modelStatus).toBe('uninitialized');
    expect(state.transcriptionStatus).toBe('idle');
    expect(state.elapsedMs).toBe(0);
    expect(state.recordedBlob).toBeNull();
    expect(state.processedAudio).toBeNull();
    expect(state.audioProcessingError).toBeNull();
    expect(state.modelProgress).toBe(0);
    expect(state.modelError).toBeNull();
    expect(state.preferredBackend).toBe('auto');
    expect(state.actualBackend).toBeNull();
    expect(state.fallbackOccurred).toBe(false);
    expect(state.fallbackReason).toBeNull();
    expect(state.transcript).toBeNull();
    expect(state.inferenceTimeMs).toBeNull();
    expect(state.realTimeFactor).toBeNull();
    expect(state.activeRequestId).toBeNull();
    expect(state.error).toBeNull();
    expect(state.typedCommand).toBe('');
  });

  it('should allow setting recordingStatus', () => {
    const store = useVoiceStore.getState();
    store.setRecordingStatus('listening');
    expect(useVoiceStore.getState().recordingStatus).toBe('listening');

    store.setRecordingStatus('ready');
    expect(useVoiceStore.getState().recordingStatus).toBe('ready');
  });

  it('should allow setting audioProcessingStatus', () => {
    const store = useVoiceStore.getState();
    store.setAudioProcessingStatus('processing');
    expect(useVoiceStore.getState().audioProcessingStatus).toBe('processing');
  });

  it('should allow setting modelStatus', () => {
    const store = useVoiceStore.getState();
    store.setModelStatus('ready');
    expect(useVoiceStore.getState().modelStatus).toBe('ready');
  });

  it('should allow setting transcriptionStatus', () => {
    const store = useVoiceStore.getState();
    store.setTranscriptionStatus('transcribing');
    expect(useVoiceStore.getState().transcriptionStatus).toBe('transcribing');
  });

  it('should allow setting elapsedMs', () => {
    const store = useVoiceStore.getState();
    store.setElapsedMs(1200);
    expect(useVoiceStore.getState().elapsedMs).toBe(1200);
  });

  it('should allow setting recordedBlob', () => {
    const store = useVoiceStore.getState();
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
    store.setRecordedBlob(mockBlob);
    expect(useVoiceStore.getState().recordedBlob).toBe(mockBlob);
  });

  it('should allow setting error', () => {
    const store = useVoiceStore.getState();
    store.setError('Test error message');
    expect(useVoiceStore.getState().error).toBe('Test error message');
  });

  it('should reset to default state', () => {
    const store = useVoiceStore.getState();
    store.setRecordingStatus('ready');
    store.setAudioProcessingStatus('ready');
    store.setModelStatus('ready');
    store.setTranscriptionStatus('completed');
    store.setElapsedMs(3500);
    store.setError('Another error');
    store.setTypedCommand('nudge left');

    store.reset();

    const state = useVoiceStore.getState();
    expect(state.recordingStatus).toBe('idle');
    expect(state.audioProcessingStatus).toBe('idle');
    expect(state.modelStatus).toBe('uninitialized');
    expect(state.transcriptionStatus).toBe('idle');
    expect(state.elapsedMs).toBe(0);
    expect(state.recordedBlob).toBeNull();
    expect(state.error).toBeNull();
  });
});
