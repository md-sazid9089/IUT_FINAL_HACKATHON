import { useEffect, useMemo, useState } from 'react';
import { useVoiceStore } from '../voice/voiceStore';
import { MediaRecorderController } from '../voice/mediaRecorderController';
import { processAudio } from '../voice/audioProcessing';
import { VoiceWorkerClient } from '../voice/voiceWorkerClient';
import { VOICE_MODEL_CONFIG } from '../voice/voiceConfig';

const RECORDING_STATE_COLORS: Record<string, string> = {
  idle: '#9aa5b1',
  'requesting-permission': '#ebcb8b',
  listening: '#bf616a',
  stopping: '#d08770',
  ready: '#a3be8c',
  cancelled: '#b48ead',
  error: '#bf616a',
};

const PROCESSING_STATE_COLORS: Record<string, string> = {
  idle: '#9aa5b1',
  processing: '#88c0d0',
  ready: '#a3be8c',
  error: '#bf616a',
};

const MODEL_STATE_COLORS: Record<string, string> = {
  uninitialized: '#9aa5b1',
  loading: '#ebcb8b',
  initializing: '#ebcb8b',
  'falling-back': '#d08770',
  ready: '#a3be8c',
  failed: '#bf616a',
};

const TRANSCRIPTION_STATE_COLORS: Record<string, string> = {
  idle: '#9aa5b1',
  transcribing: '#88c0d0',
  completed: '#a3be8c',
  cancelled: '#b48ead',
  error: '#bf616a',
};

export function VoicePanel() {
  const recordingStatus = useVoiceStore((s) => s.recordingStatus);
  const audioProcessingStatus = useVoiceStore((s) => s.audioProcessingStatus);
  const modelStatus = useVoiceStore((s) => s.modelStatus);
  const transcriptionStatus = useVoiceStore((s) => s.transcriptionStatus);

  const elapsedMs = useVoiceStore((s) => s.elapsedMs);
  const recordedBlob = useVoiceStore((s) => s.recordedBlob);
  const processedAudio = useVoiceStore((s) => s.processedAudio);
  const audioProcessingError = useVoiceStore((s) => s.audioProcessingError);

  const modelProgress = useVoiceStore((s) => s.modelProgress);
  const modelError = useVoiceStore((s) => s.modelError);
  const preferredBackend = useVoiceStore((s) => s.preferredBackend);
  const actualBackend = useVoiceStore((s) => s.actualBackend);
  const fallbackOccurred = useVoiceStore((s) => s.fallbackOccurred);
  const fallbackReason = useVoiceStore((s) => s.fallbackReason);

  const transcript = useVoiceStore((s) => s.transcript);
  const inferenceTimeMs = useVoiceStore((s) => s.inferenceTimeMs);
  const realTimeFactor = useVoiceStore((s) => s.realTimeFactor);
  const error = useVoiceStore((s) => s.error);
  const browserSupport = useVoiceStore((s) => s.browserSupport);
  const typedCommand = useVoiceStore((s) => s.typedCommand);


  const setAudioProcessingStatus = useVoiceStore((s) => s.setAudioProcessingStatus);
  const setProcessedAudio = useVoiceStore((s) => s.setProcessedAudio);
  const setAudioProcessingError = useVoiceStore((s) => s.setAudioProcessingError);
  const setTranscript = useVoiceStore((s) => s.setTranscript);
  const setTypedCommand = useVoiceStore((s) => s.setTypedCommand);
  const resetStore = useVoiceStore((s) => s.reset);

  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const recorderController = useMemo(() => new MediaRecorderController(), []);
  const workerClient = useMemo(() => new VoiceWorkerClient(), []);

  // Sync unmount and visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recorderController.cancel('Recording stopped because the page became inactive.');
        workerClient.cancelActiveTranscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen to files downloading from worker via global event if needed
    // In our case progress update triggers state change, but let's capture file name
    const handleProgressFile = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.file) {
        setLoadingFile(customEvent.detail.file);
      }
    };
    window.addEventListener('voice-model-loading-file', handleProgressFile);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('voice-model-loading-file', handleProgressFile);
      recorderController.cleanup();
      workerClient.dispose();
      resetStore();
    };
  }, [recorderController, workerClient, resetStore]);

  // Derived mic status text
  const micStatusText = useMemo(() => {
    if (recordingStatus === 'requesting-permission') return 'Requesting permission...';
    if (recordingStatus === 'error' && error?.includes('permission')) return 'Permission denied';
    if (recordingStatus === 'listening' || recordingStatus === 'ready') return 'Active / Granted';
    return 'Not requested';
  }, [recordingStatus, error]);

  const handlePrepareAudio = async () => {
    if (!recordedBlob) return;
    setAudioProcessingStatus('processing');
    setAudioProcessingError(null);
    setProcessedAudio(null);

    try {
      const result = await processAudio(recordedBlob);
      setProcessedAudio(result);
      setAudioProcessingStatus('ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to preprocess recorded audio.';
      setAudioProcessingError(msg);
      setAudioProcessingStatus('error');
    }
  };

  const handleInitializeModel = () => {
    workerClient.initModel(VOICE_MODEL_CONFIG.modelId, VOICE_MODEL_CONFIG.preferredBackend);
  };

  const handleTranscribe = () => {
    if (!processedAudio) return;
    workerClient.transcribe(processedAudio.pcm, processedAudio.processedDurationSeconds);
  };

  const handleCancelTranscription = () => {
    workerClient.cancelActiveTranscription();
  };

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  return (
    <section className="panel voice-panel">
      <h2>Voice Control</h2>
      <p className="muted small">Push-to-talk recording · maximum 5 seconds duration</p>

      {/* Browser Support Diagnostic */}
      <div className="readout">
        <div className="readout-label">Browser Support</div>
        <div
          className="readout-value mono"
          style={{ color: browserSupport.supported ? '#a3be8c' : '#bf616a' }}
        >
          {browserSupport.supported ? 'Supported' : 'Unsupported'}
        </div>
        {!browserSupport.supported && browserSupport.reason && (
          <p className="fail-row small" style={{ margin: '0.2rem 0 0' }}>
            {browserSupport.reason}
          </p>
        )}
      </div>

      {/* Mic Permission State */}
      <div className="readout">
        <div className="readout-label">Microphone Status</div>
        <div className="readout-value mono">{micStatusText}</div>
      </div>

      {/* Grid of lifecycles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.5rem 0' }}>
        <div className="readout" style={{ margin: 0 }}>
          <div className="readout-label">Record State</div>
          <div className="readout-value">
            <span
              className="state-badge"
              style={{
                background: RECORDING_STATE_COLORS[recordingStatus] || '#9aa5b1',
                color: '#1e222a',
                fontSize: '0.7rem',
                padding: '0.15rem 0.35rem',
                textTransform: 'uppercase',
              }}
            >
              {recordingStatus}
            </span>
          </div>
        </div>

        <div className="readout" style={{ margin: 0 }}>
          <div className="readout-label">Preprocess</div>
          <div className="readout-value">
            <span
              className="state-badge"
              style={{
                background: PROCESSING_STATE_COLORS[audioProcessingStatus] || '#9aa5b1',
                color: '#1e222a',
                fontSize: '0.7rem',
                padding: '0.15rem 0.35rem',
                textTransform: 'uppercase',
              }}
            >
              {audioProcessingStatus}
            </span>
          </div>
        </div>

        <div className="readout" style={{ margin: 0 }}>
          <div className="readout-label">Local Model</div>
          <div className="readout-value">
            <span
              className="state-badge"
              style={{
                background: MODEL_STATE_COLORS[modelStatus] || '#9aa5b1',
                color: '#1e222a',
                fontSize: '0.7rem',
                padding: '0.15rem 0.35rem',
                textTransform: 'uppercase',
              }}
            >
              {modelStatus}
            </span>
          </div>
        </div>

        <div className="readout" style={{ margin: 0 }}>
          <div className="readout-label">ASR State</div>
          <div className="readout-value">
            <span
              className="state-badge"
              style={{
                background: TRANSCRIPTION_STATE_COLORS[transcriptionStatus] || '#9aa5b1',
                color: '#1e222a',
                fontSize: '0.7rem',
                padding: '0.15rem 0.35rem',
                textTransform: 'uppercase',
              }}
            >
              {transcriptionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className="readout">
        <div className="readout-label">Recording Timer</div>
        <div className="readout-value mono">{elapsedSec} / 5.0 s</div>
      </div>

      {/* Recording Error */}
      {error && <p className="fail-row small">{error}</p>}

      {/* Push-to-talk Controls */}
      <div className="button-row" style={{ marginBottom: '0.75rem' }}>
        {recordingStatus === 'listening' || recordingStatus === 'stopping' ? (
          <>
            <button
              onClick={() => recorderController.stop()}
              disabled={recordingStatus === 'stopping'}
              className="stop-btn"
            >
              Stop
            </button>
            <button onClick={() => recorderController.cancel()} className="cancel-btn">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => recorderController.start()}
            disabled={!browserSupport.supported || recordingStatus === 'requesting-permission'}
            className="talk-btn"
          >
            {recordingStatus === 'requesting-permission' ? 'Requesting...' : 'Start Talking'}
          </button>
        )}
      </div>

      {/* Phase 2: Audio Preprocessing triggers and diagnostics */}
      {recordedBlob && (
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: 'var(--accent)' }}>Audio Preprocessing</h4>
          {audioProcessingStatus !== 'ready' && (
            <button
              onClick={handlePrepareAudio}
              disabled={audioProcessingStatus === 'processing'}
              className="talk-btn"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', width: 'auto', display: 'inline-block' }}
            >
              {audioProcessingStatus === 'processing' ? 'Preparing...' : 'Prepare Audio'}
            </button>
          )}

          {audioProcessingError && <p className="fail-row small">{audioProcessingError}</p>}

          {processedAudio && (
            <div className="small mono" style={{ marginTop: '0.4rem', background: '#1c1f26', padding: '0.4rem', borderRadius: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.2rem' }}>
                <div>Orig. Duration:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.originalDurationSeconds.toFixed(2)} s</div>
                <div>Proc. Duration:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.processedDurationSeconds.toFixed(2)} s</div>
                <div>Orig. Sample Rate:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.originalSampleRate} Hz</div>
                <div>Out. Sample Rate:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.sampleRate} Hz</div>
                <div>Orig. Channels:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.originalChannelCount}</div>
                <div>Out. Channels:</div>
                <div style={{ textAlign: 'right' }}>{processedAudio.outputChannelCount}</div>
                <div>Orig. Peak/RMS:</div>
                <div style={{ textAlign: 'right' }}>
                  {processedAudio.originalPeakAmplitude.toFixed(3)} / {processedAudio.originalRmsAmplitude.toFixed(3)}
                </div>
                <div>Proc. Peak/RMS:</div>
                <div style={{ textAlign: 'right' }}>
                  {processedAudio.processedPeakAmplitude.toFixed(3)} / {processedAudio.processedRmsAmplitude.toFixed(3)}
                </div>
                <div>Silence Trimmed:</div>
                <div style={{ textAlign: 'right', color: processedAudio.trimmed ? '#a3be8c' : 'var(--text-muted)' }}>
                  {processedAudio.trimmed ? 'Yes' : 'No'}
                </div>
                {processedAudio.trimmed && (
                  <>
                    <div>Trim Samples (L/T):</div>
                    <div style={{ textAlign: 'right' }}>
                      {processedAudio.leadingTrimSamples} / {processedAudio.trailingTrimSamples}
                    </div>
                    <div>Padding Samples:</div>
                    <div style={{ textAlign: 'right' }}>{processedAudio.trimPaddingSamples}</div>
                  </>
                )}
              </div>
              <div style={{ color: '#a3be8c', marginTop: '0.4rem', borderTop: '1px solid #2b303c', paddingTop: '0.2rem' }}>
                Status: Ready for local ASR
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 3: Local Whisper engine loading and diagnostics */}
      <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
        <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: 'var(--accent)' }}>Local Voice Engine</h4>
        
        <div className="small mono" style={{ marginBottom: '0.4rem', background: '#1c1f26', padding: '0.4rem', borderRadius: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.2rem' }}>
            <div>Model ID:</div>
            <div style={{ textAlign: 'right', fontSize: '0.7rem' }}>{VOICE_MODEL_CONFIG.modelId}</div>
            <div>Cache status:</div>
            <div style={{ textAlign: 'right', color: '#ebcb8b' }}>Unknown</div>
            <div>Pref. Backend:</div>
            <div style={{ textAlign: 'right', textTransform: 'capitalize' }}>{preferredBackend}</div>
            <div>Act. Backend:</div>
            <div style={{ textAlign: 'right', textTransform: 'uppercase', color: actualBackend ? '#a3be8c' : 'var(--text-muted)' }}>
              {actualBackend || 'None'}
            </div>
            <div>Fallback:</div>
            <div style={{ textAlign: 'right', color: fallbackOccurred ? '#d08770' : 'var(--text-muted)' }}>
              {fallbackOccurred ? 'Yes' : 'No'}
            </div>
            {fallbackReason && (
              <>
                <div style={{ fontSize: '0.7rem', color: '#d08770', gridColumn: 'span 2' }}>
                  Fallback Reason: {fallbackReason}
                </div>
              </>
            )}
          </div>

          {/* Model Loading progress bar */}
          {(modelStatus === 'loading' || modelStatus === 'initializing') && (
            <div style={{ marginTop: '0.4rem' }}>
              <div style={{ height: '6px', background: '#2b303c', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    height: '100%',
                    background: '#ebcb8b',
                    width: modelProgress > 0 ? `${(modelProgress * 100).toFixed(0)}%` : '30%',
                    animation: modelProgress === 0 ? 'pulse 1.5s infinite' : 'none',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginTop: '0.15rem' }}>
                <span>Downloading Weights...</span>
                <span>{modelProgress > 0 ? `${(modelProgress * 100).toFixed(0)}%` : 'Indeterminate'}</span>
              </div>
              {loadingFile && (
                <div className="small muted" style={{ fontSize: '0.6rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  File: {loadingFile}
                </div>
              )}
            </div>
          )}
        </div>

        {modelError && <p className="fail-row small">{modelError}</p>}

        <div className="button-row" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          {modelStatus === 'uninitialized' || modelStatus === 'failed' ? (
            <button onClick={handleInitializeModel} className="talk-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', width: 'auto' }}>
              Initialize Voice Engine
            </button>
          ) : null}

          {modelStatus === 'failed' && (
            <button onClick={handleInitializeModel} className="talk-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: '#bf616a' }}>
              Retry Model Load
            </button>
          )}

          {modelStatus === 'ready' && audioProcessingStatus === 'ready' && transcriptionStatus !== 'transcribing' && (
            <button onClick={handleTranscribe} className="talk-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: '#a3be8c', color: '#1e222a' }}>
              Transcribe
            </button>
          )}

          {transcriptionStatus === 'transcribing' && (
            <button onClick={handleCancelTranscription} className="cancel-btn" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', width: 'auto' }}>
              Cancel Transcription
            </button>
          )}
        </div>
      </div>

      {/* Transcription outputs and real latency indicators */}
      {(transcript || transcriptionStatus === 'transcribing' || transcriptionStatus === 'completed' || transcriptionStatus === 'error') && (
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', color: 'var(--accent)' }}>ASR Output</h4>

          <div
            className="small mono"
            style={{
              background: '#1c1f26',
              padding: '0.5rem',
              borderRadius: '4px',
              borderLeft: '3px solid var(--accent)',
              minHeight: '2rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {transcriptionStatus === 'transcribing' ? (
              <span className="muted" style={{ animation: 'blink 1s infinite' }}>Transcribing local audio buffer...</span>
            ) : transcript ? (
              <span>{transcript}</span>
            ) : (
              <span className="muted">No transcript available.</span>
            )}
          </div>

          {inferenceTimeMs !== null && realTimeFactor !== null && (
            <div className="small mono muted" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.1rem', marginTop: '0.35rem', fontSize: '0.7rem' }}>
              <div>Inference Time:</div>
              <div style={{ textAlign: 'right' }}>{inferenceTimeMs.toFixed(0)} ms</div>
              <div>Real-Time Factor (RTF):</div>
              <div style={{ textAlign: 'right', color: realTimeFactor < 1.0 ? '#a3be8c' : '#ebcb8b' }}>
                {realTimeFactor.toFixed(3)}
              </div>
            </div>
          )}

          {transcript && (
            <button
              onClick={() => setTranscript(null)}
              className="cancel-btn"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', width: 'auto', marginTop: '0.4rem' }}
            >
              Reset Transcript
            </button>
          )}
        </div>
      )}

      {/* Typed Command Fallback */}
      <div
        style={{
          borderTop: '1px solid var(--panel-border)',
          paddingTop: '0.75rem',
          marginTop: '0.75rem',
        }}
      >
        <label className="field-label" htmlFor="typed-voice-command">
          Typed Fallback Command
        </label>
        <input
          id="typed-voice-command"
          className="pin-input mono"
          value={typedCommand}
          maxLength={200}
          placeholder="e.g. press key five"
          onChange={(e) => setTypedCommand(e.currentTarget.value)}
        />
        <div
          className="small muted"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{typedCommand.trim().length}/200 chars</span>
          {typedCommand && (
            <button
              onClick={() => setTypedCommand('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.72rem',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <p className="muted small" style={{ marginTop: '0.35rem', fontStyle: 'italic' }}>
          Raw transcript only. Command parsing and robot execution are not enabled in this phase.
        </p>
      </div>
    </section>
  );
}
