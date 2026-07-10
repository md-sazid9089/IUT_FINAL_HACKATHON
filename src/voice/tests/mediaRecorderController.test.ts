import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVoiceStore } from '../voiceStore';
import { MediaRecorderController } from '../mediaRecorderController';

// Simple Mocks
class MockMediaStreamTrack {
  enabled = true;
  stop = vi.fn();
}

class MockMediaStream {
  tracks = [new MockMediaStreamTrack(), new MockMediaStreamTrack()];
  getTracks() {
    return this.tracks;
  }
}

class MockMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  stream: MockMediaStream;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: { error: Error }) => void) | null = null;
  mimeType = 'audio/webm';

  constructor(stream: MockMediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    // Simulate data chunk callback
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['chunk data'], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
}

describe('MediaRecorderController', () => {
  let controller: MediaRecorderController;
  let mockStream: MockMediaStream;

  beforeEach(() => {
    vi.useFakeTimers();
    useVoiceStore.getState().reset();

    // Stub navigator and MediaRecorder
    mockStream = new MockMediaStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    // Set browser supported status to true
    useVoiceStore.setState({
      browserSupport: {
        secureContext: true,
        mediaDevicesAvailable: true,
        getUserMediaAvailable: true,
        mediaRecorderAvailable: true,
        supported: true,
      },
    });

    controller = new MediaRecorderController();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    controller.cleanup();
  });

  it('should transition to requesting-permission then listening', async () => {
    const startPromise = controller.start();
    expect(useVoiceStore.getState().recordingStatus).toBe('requesting-permission');

    await startPromise;
    expect(useVoiceStore.getState().recordingStatus).toBe('listening');
    expect(useVoiceStore.getState().error).toBeNull();
  });

  it('should handle permission denied NotAllowedError', async () => {
    const errorObj = { name: 'NotAllowedError', message: 'Permission denied' };
    (
      navigator.mediaDevices.getUserMedia as unknown as { mockRejectedValue: (v: unknown) => void }
    ).mockRejectedValue(errorObj);

    await controller.start();

    expect(useVoiceStore.getState().recordingStatus).toBe('error');
    expect(useVoiceStore.getState().error).toContain('permission was denied');
  });

  it('should support manual stop', async () => {
    await controller.start();
    expect(useVoiceStore.getState().recordingStatus).toBe('listening');

    vi.advanceTimersByTime(1000); // 1.0s

    controller.stop();
    expect(useVoiceStore.getState().recordingStatus).toBe('ready');
    expect(useVoiceStore.getState().recordedBlob).toBeInstanceOf(Blob);
    expect(useVoiceStore.getState().error).toBeNull();

    // Verify tracks are stopped
    mockStream.tracks.forEach((track) => {
      expect(track.stop).toHaveBeenCalled();
    });
  });

  it('should support cancellation', async () => {
    await controller.start();
    vi.advanceTimersByTime(1000);

    controller.cancel();
    expect(useVoiceStore.getState().recordingStatus).toBe('cancelled');
    expect(useVoiceStore.getState().recordedBlob).toBeNull();

    mockStream.tracks.forEach((track) => {
      expect(track.stop).toHaveBeenCalled();
    });
  });

  it('should automatically stop after 5 seconds', async () => {
    await controller.start();
    expect(useVoiceStore.getState().recordingStatus).toBe('listening');

    // Advance timer to 5000ms
    vi.advanceTimersByTime(5000);
    expect(useVoiceStore.getState().recordingStatus).toBe('ready');
    expect(useVoiceStore.getState().elapsedMs).toBe(5000);
  });
});
