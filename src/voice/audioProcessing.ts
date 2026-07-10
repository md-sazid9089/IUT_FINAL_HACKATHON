import { ProcessedVoiceAudio, VoiceAudioErrorCode } from './voiceStore';
import { VOICE_AUDIO_CONFIG } from './voiceConfig';

export class AudioProcessingError extends Error {
  constructor(
    public readonly code: VoiceAudioErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AudioProcessingError';
  }
}

/**
 * Converts a raw recording Blob into a processed mono Float32Array PCM buffer at 16 kHz,
 * validated for duration and amplitude limits.
 */
export async function processAudio(blob: Blob): Promise<ProcessedVoiceAudio> {
  if (!blob || blob.size === 0) {
    throw new AudioProcessingError('EMPTY_BLOB', 'Recorded audio Blob is empty.');
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await blob.arrayBuffer();
  } catch {
    throw new AudioProcessingError('DECODE_FAILED', 'Failed to read Blob as ArrayBuffer.');
  }

  let audioCtx: AudioContext | null = null;
  let audioBuffer: AudioBuffer;

  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new AudioProcessingError('AUDIO_CONTEXT_UNAVAILABLE', 'Web Audio API is not supported.');
    }
    audioCtx = new AudioContextClass();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err: unknown) {
    if (err instanceof AudioProcessingError) throw err;
    const msg = err instanceof Error ? err.message : 'Unsupported format';
    throw new AudioProcessingError('DECODE_FAILED', `Audio decoding failed: ${msg}`);
  } finally {
    if (audioCtx) {
      try {
        await audioCtx.close();
      } catch {
        // ignore context close failures
      }
    }
  }

  const originalDurationSeconds = audioBuffer.duration;
  const originalSampleRate = audioBuffer.sampleRate;
  const originalChannelCount = audioBuffer.numberOfChannels;

  if (originalChannelCount === 0 || audioBuffer.length === 0) {
    throw new AudioProcessingError('EMPTY_AUDIO_BUFFER', 'Decoded audio contains no samples.');
  }

  // 1. Multichannel mixing to mono
  const monoPcm = mixToMono(audioBuffer);

  // 2. Validate finite samples
  validateFiniteSamples(monoPcm, 'original mono PCM');

  // 3. Compute original metrics
  const originalMetrics = calculateMetrics(monoPcm);

  // 4. Resample to 16 kHz
  const resampledPcm = await resampleTo16k(monoPcm, originalSampleRate);
  validateFiniteSamples(resampledPcm, 'resampled PCM');

  // 5. Silence trimming with padding
  const trimResult = trimSilence(resampledPcm, VOICE_AUDIO_CONFIG.targetSampleRate);

  // 6. Compute final metrics
  const processedMetrics = calculateMetrics(trimResult.pcm);

  // 7. Processed duration and silence validation
  const processedDurationSeconds = trimResult.pcm.length / VOICE_AUDIO_CONFIG.targetSampleRate;
  const processedDurationMs = processedDurationSeconds * 1000;

  if (processedDurationMs < VOICE_AUDIO_CONFIG.minProcessedAudioMs) {
    throw new AudioProcessingError(
      'AUDIO_TOO_SHORT',
      `Processed audio duration (${processedDurationMs.toFixed(0)} ms) is below the minimum limit of ${VOICE_AUDIO_CONFIG.minProcessedAudioMs} ms.`
    );
  }

  if (processedDurationMs > VOICE_AUDIO_CONFIG.maxProcessedAudioMs) {
    throw new AudioProcessingError(
      'AUDIO_TOO_LONG',
      `Processed audio duration (${processedDurationMs.toFixed(0)} ms) exceeds the maximum limit of ${VOICE_AUDIO_CONFIG.maxProcessedAudioMs} ms.`
    );
  }

  if (processedMetrics.rms < VOICE_AUDIO_CONFIG.minimumRmsThreshold) {
    throw new AudioProcessingError(
      'SILENT_AUDIO',
      `Captured audio is silent or too quiet (RMS: ${processedMetrics.rms.toFixed(5)}, minimum threshold: ${VOICE_AUDIO_CONFIG.minimumRmsThreshold}).`
    );
  }

  if (processedMetrics.peak === 0) {
    throw new AudioProcessingError('SILENT_AUDIO', 'Audio peak amplitude is exactly zero.');
  }

  return {
    pcm: trimResult.pcm,
    sampleRate: VOICE_AUDIO_CONFIG.targetSampleRate,
    originalDurationSeconds,
    processedDurationSeconds,
    originalSampleRate,
    originalChannelCount,
    outputChannelCount: 1,
    originalPeakAmplitude: originalMetrics.peak,
    originalRmsAmplitude: originalMetrics.rms,
    processedPeakAmplitude: processedMetrics.peak,
    processedRmsAmplitude: processedMetrics.rms,
    trimmed: trimResult.trimmed,
    leadingTrimSamples: trimResult.leadingTrimSamples,
    trailingTrimSamples: trimResult.trailingTrimSamples,
    trimPaddingSamples: trimResult.trimPaddingSamples,
  };
}

/** Mixes stereo/multichannel tracks into a single mono track. */
export function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  if (channelCount === 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  // Verify equal lengths and mix channels
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    const data = audioBuffer.getChannelData(c);
    if (data.length !== length) {
      throw new AudioProcessingError('INVALID_CHANNEL_DATA', 'Audio channels have mismatched lengths.');
    }
    channels.push(data);
  }

  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < channelCount; c++) {
      const chan = channels[c];
      if (chan) {
        sum += chan[i] ?? 0;
      }
    }
    mono[i] = sum / channelCount;
  }
  return mono;
}

/** OfflineAudioContext resampling logic. */
export async function resampleTo16k(monoPcm: Float32Array, originalSampleRate: number): Promise<Float32Array> {
  const targetRate = VOICE_AUDIO_CONFIG.targetSampleRate;
  if (originalSampleRate === targetRate) {
    return monoPcm.slice();
  }

  if (originalSampleRate <= 0) {
    throw new AudioProcessingError('INVALID_SAMPLE_RATE', 'Original sample rate must be greater than zero.');
  }

  const targetLength = Math.round((monoPcm.length * targetRate) / originalSampleRate);
  if (targetLength <= 0) {
    throw new AudioProcessingError('RESAMPLE_FAILED', 'Resampling yielded an empty buffer.');
  }

  let offlineCtx: OfflineAudioContext | null = null;
  try {
    const OfflineCtxClass = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OfflineCtxClass) {
      throw new AudioProcessingError('AUDIO_CONTEXT_UNAVAILABLE', 'OfflineAudioContext is not supported.');
    }

    offlineCtx = new OfflineCtxClass(1, targetLength, targetRate);
    const bufferSource = offlineCtx.createBuffer(1, monoPcm.length, originalSampleRate);
    bufferSource.getChannelData(0).set(monoPcm);

    const node = offlineCtx.createBufferSource();
    node.buffer = bufferSource;
    node.connect(offlineCtx.destination);
    node.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const renderedPcm = renderedBuffer.getChannelData(0);

    // Return an owned copy
    return new Float32Array(renderedPcm);
  } catch (err: unknown) {
    if (err instanceof AudioProcessingError) throw err;
    const msg = err instanceof Error ? err.message : 'rendering error';
    throw new AudioProcessingError('RESAMPLE_FAILED', `Audio resampling failed: ${msg}`);
  }
}

/** Pure helper to calculate peak and RMS amplitudes. */
export function calculateMetrics(pcm: Float32Array): { peak: number; rms: number } {
  const length = pcm.length;
  if (length === 0) {
    return { peak: 0, rms: 0 };
  }

  let maxAbs = 0;
  let squareSum = 0;

  for (let i = 0; i < length; i++) {
    const val = pcm[i];
    if (val !== undefined) {
      if (!Number.isFinite(val)) {
        throw new AudioProcessingError('NON_FINITE_PCM', 'Non-finite sample found in PCM.');
      }
      const absVal = Math.abs(val);
      if (absVal > maxAbs) {
        maxAbs = absVal;
      }
      squareSum += val * val;
    }
  }

  const rms = Math.sqrt(squareSum / length);
  return { peak: maxAbs, rms };
}

/** Trims leading and trailing silence using configurable thresholds and adds padding. */
export function trimSilence(
  pcm: Float32Array,
  sampleRate: number
): {
  pcm: Float32Array;
  trimmed: boolean;
  leadingTrimSamples: number;
  trailingTrimSamples: number;
  trimPaddingSamples: number;
} {
  const threshold = VOICE_AUDIO_CONFIG.silenceAmplitudeThreshold;
  const paddingMs = VOICE_AUDIO_CONFIG.trimPaddingMs;
  const length = pcm.length;

  let firstIndex = -1;
  let lastIndex = -1;

  for (let i = 0; i < length; i++) {
    const val = pcm[i];
    if (val !== undefined && Math.abs(val) >= threshold) {
      firstIndex = i;
      break;
    }
  }

  // Entirely silent or below threshold
  if (firstIndex === -1) {
    return {
      pcm: pcm.slice(),
      trimmed: false,
      leadingTrimSamples: 0,
      trailingTrimSamples: 0,
      trimPaddingSamples: 0,
    };
  }

  for (let i = length - 1; i >= firstIndex; i--) {
    const val = pcm[i];
    if (val !== undefined && Math.abs(val) >= threshold) {
      lastIndex = i;
      break;
    }
  }

  const paddingSamples = Math.round((paddingMs * sampleRate) / 1000);
  const start = Math.max(0, firstIndex - paddingSamples);
  const end = Math.min(length, lastIndex + 1 + paddingSamples);

  const trimmedPcm = pcm.slice(start, end);
  const leadingTrim = start;
  const trailingTrim = length - end;
  const trimPadding = (firstIndex - start) + (end - 1 - lastIndex);

  return {
    pcm: trimmedPcm,
    trimmed: true,
    leadingTrimSamples: leadingTrim,
    trailingTrimSamples: trailingTrim,
    trimPaddingSamples: trimPadding,
  };
}

function validateFiniteSamples(pcm: Float32Array, label: string): void {
  for (let i = 0; i < pcm.length; i++) {
    const val = pcm[i];
    if (val === undefined || !Number.isFinite(val)) {
      throw new AudioProcessingError('NON_FINITE_PCM', `Non-finite sample found in ${label} at index ${i}.`);
    }
  }
}
