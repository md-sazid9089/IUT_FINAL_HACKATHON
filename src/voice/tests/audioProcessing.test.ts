import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processAudio,
  mixToMono,
  resampleTo16k,
  calculateMetrics,
  trimSilence,
  AudioProcessingError,
} from '../audioProcessing';

class MockAudioBuffer {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  data: Float32Array[];

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this.data = Array.from({ length: options.numberOfChannels }, () => new Float32Array(options.length));
  }

  getChannelData(channel: number) {
    const channelData = this.data[channel];
    if (!channelData) throw new Error('Invalid channel index');
    return channelData;
  }

  copyToChannel(source: Float32Array, channelNumber: number) {
    const channelData = this.data[channelNumber];
    if (!channelData) throw new Error('Invalid channel index');
    channelData.set(source);
  }
}

class MockAudioContext {
  decodeAudioData = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
}

class MockOfflineAudioContext {
  length: number;
  sampleRate: number;
  channels: number;

  constructor(channels: number, length: number, sampleRate: number) {
    this.channels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createBuffer(channels: number, length: number, rate: number) {
    return new MockAudioBuffer({ numberOfChannels: channels, length, sampleRate: rate });
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      buffer: null,
    };
  }

  destination = {};

  async startRendering() {
    const rendered = new MockAudioBuffer({
      numberOfChannels: 1,
      length: this.length,
      sampleRate: this.sampleRate,
    });
    // Fill with simulated 1kHz sinewave for metrics tests
    const data = rendered.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / this.sampleRate);
    }
    return rendered;
  }
}

describe('Audio Preprocessing (Phase 2)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(function () {
        return new MockAudioContext();
      })
    );
    vi.stubGlobal(
      'OfflineAudioContext',
      vi.fn().mockImplementation(function (channels: number, length: number, sampleRate: number) {
        return new MockOfflineAudioContext(channels, length, sampleRate);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects empty Blobs', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' });
    await expect(processAudio(emptyBlob)).rejects.toThrowError(
      new AudioProcessingError('EMPTY_BLOB', 'Recorded audio Blob is empty.')
    );
  });

  it('handles decode failures gracefully', async () => {
    const mockCtx = new MockAudioContext();
    mockCtx.decodeAudioData.mockRejectedValue(new Error('Decode error'));
    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(function () {
        return mockCtx;
      })
    );

    const mockBlob = new Blob(['corrupted data'], { type: 'audio/webm' });
    await expect(processAudio(mockBlob)).rejects.toThrowError(/decoding failed/);
    expect(mockCtx.close).toHaveBeenCalled();
  });

  it('mixes mono correctly (unmodified)', () => {
    const buffer = new MockAudioBuffer({ numberOfChannels: 1, length: 10, sampleRate: 16000 });
    const chanData = buffer.getChannelData(0);
    for (let i = 0; i < 10; i++) chanData[i] = i * 0.1;

    const mono = mixToMono(buffer as unknown as AudioBuffer);
    expect(mono.length).toBe(10);
    expect(mono[3]).toBeCloseTo(0.3);
  });

  it('averages stereo channels correctly', () => {
    const buffer = new MockAudioBuffer({ numberOfChannels: 2, length: 5, sampleRate: 16000 });
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    ch0.set([1.0, 0.8, 0.6, 0.4, 0.2]);
    ch1.set([-1.0, -0.8, -0.6, -0.4, -0.2]);

    const mono = mixToMono(buffer as unknown as AudioBuffer);
    expect(mono.length).toBe(5);
    mono.forEach((sample) => expect(sample).toBeCloseTo(0.0));
  });

  it('rejects mismatched stereo channel lengths', () => {
    const buffer = new MockAudioBuffer({ numberOfChannels: 2, length: 5, sampleRate: 16000 });
    // Manually force length discrepancy in mock data array
    buffer.data[1] = new Float32Array(4);

    expect(() => mixToMono(buffer as unknown as AudioBuffer)).toThrowError('mismatched lengths');
  });

  it('calculates metrics (RMS and Peak) accurately', () => {
    const pcm = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const metrics = calculateMetrics(pcm);

    expect(metrics.peak).toBe(0.5);
    expect(metrics.rms).toBeCloseTo(0.5); // sqrt(0.25*4 / 4) = 0.5
  });

  it('rejects non-finite samples during metrics calculation', () => {
    const pcmNaN = new Float32Array([0.1, NaN, 0.3]);
    expect(() => calculateMetrics(pcmNaN)).toThrowError(/non-finite/i);

    const pcmInf = new Float32Array([0.1, Infinity, 0.3]);
    expect(() => calculateMetrics(pcmInf)).toThrowError(/non-finite/i);
  });

  it('resamples 48 kHz to 16 kHz using OfflineAudioContext', async () => {
    const pcm = new Float32Array(4800); // 100ms at 48kHz
    const resampled = await resampleTo16k(pcm, 48000);

    expect(resampled.length).toBe(1600); // Should scale down by 3x
  });

  it('resamples 44.1 kHz to 16 kHz using OfflineAudioContext', async () => {
    const pcm = new Float32Array(44100); // 1s at 44.1kHz
    const resampled = await resampleTo16k(pcm, 44100);

    expect(resampled.length).toBe(16000);
  });

  it('passes 16 kHz directly without resampling', async () => {
    const pcm = new Float32Array(16000);
    const resampled = await resampleTo16k(pcm, 16000);

    expect(resampled.length).toBe(16000);
    expect(resampled).not.toBe(pcm); // Should return a slice/copy
  });

  it('trims leading and trailing silence with padding', () => {
    const sampleRate = 1000; // Mock sample rate
    const pcm = new Float32Array(1000); // 1000 samples
    pcm[200] = 0.5; // Event starts
    pcm[500] = 0.5; // Event ends

    const trim = trimSilence(pcm, sampleRate);
    expect(trim.trimmed).toBe(true);

    // Padding Ms = 80ms => 80 samples at 1000Hz
    const expectedStart = Math.max(0, 200 - 80); // 120
    const expectedEnd = Math.min(1000, 500 + 1 + 80); // 581

    expect(trim.pcm.length).toBe(expectedEnd - expectedStart);
    expect(trim.leadingTrimSamples).toBe(expectedStart);
    expect(trim.trailingTrimSamples).toBe(pcm.length - expectedEnd);
  });

  it('retains internal pauses during silence trimming', () => {
    const sampleRate = 1000;
    const pcm = new Float32Array(1000);
    pcm[150] = 0.8;
    // Internal silence between 200 and 400
    pcm[500] = 0.8;

    const trim = trimSilence(pcm, sampleRate);
    expect(trim.pcm.length).toBeGreaterThan(350); // Checks that internal silence wasn't stripped
  });

  it('reverts to original PCM if entirely silent or below threshold', () => {
    const sampleRate = 1000;
    const pcm = new Float32Array(500); // All zeroes
    const trim = trimSilence(pcm, sampleRate);

    expect(trim.trimmed).toBe(false);
    expect(trim.pcm.length).toBe(500);
  });

  it('end-to-end processAudio execution returns valid contract', async () => {
    const mockCtx = new MockAudioContext();
    const buffer = new MockAudioBuffer({ numberOfChannels: 2, length: 48000, sampleRate: 48000 });
    // Fill channels with valid test waveform
    buffer.getChannelData(0).fill(0.3);
    buffer.getChannelData(1).fill(0.3);

    mockCtx.decodeAudioData.mockResolvedValue(buffer);
    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(function () {
        return mockCtx;
      })
    );

    const mockBlob = new Blob(['wavelet data'], { type: 'audio/wav' });
    const result = await processAudio(mockBlob);

    expect(result.sampleRate).toBe(16000);
    expect(result.originalChannelCount).toBe(2);
    expect(result.outputChannelCount).toBe(1);
    expect(result.originalSampleRate).toBe(48000);
    expect(result.processedDurationSeconds).toBeCloseTo(1.0);
    expect(result.pcm).toBeInstanceOf(Float32Array);
    expect(result.originalPeakAmplitude).toBeCloseTo(0.3);
    expect(result.originalRmsAmplitude).toBeCloseTo(0.3);
    expect(result.processedPeakAmplitude).toBeGreaterThan(0);
    expect(result.processedRmsAmplitude).toBeGreaterThan(0);
  });
});
