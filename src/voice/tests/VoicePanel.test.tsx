import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoicePanel } from '../../ui/VoicePanel';
import { useVoiceStore } from '../voiceStore';

// Simple Mocks
class MockMediaStreamTrack {
  enabled = true;
  stop = vi.fn();
}

class MockMediaStream {
  tracks = [new MockMediaStreamTrack()];
  getTracks() {
    return this.tracks;
  }
}

class MockMediaRecorder {
  state = 'inactive';
  start = vi.fn();
  stop = vi.fn();
}

describe('VoicePanel Component', () => {
  beforeEach(() => {
    useVoiceStore.getState().reset();
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
      },
      writable: true,
      configurable: true,
    });

    // Mock browser support check
    useVoiceStore.setState({
      browserSupport: {
        secureContext: true,
        mediaDevicesAvailable: true,
        getUserMediaAvailable: true,
        mediaRecorderAvailable: true,
        supported: true,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the title and elements', () => {
    render(<VoicePanel />);

    expect(screen.getByRole('heading', { name: 'Voice Control' })).toBeInTheDocument();
    expect(screen.getByText('Browser Support')).toBeInTheDocument();
    expect(screen.getByText('Microphone Status')).toBeInTheDocument();
    expect(screen.getByText('Record State')).toBeInTheDocument();
    expect(screen.getByText('Start Talking')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. press key five')).toBeInTheDocument();
  });

  it('allows typed fallback input and clear action', async () => {
    render(<VoicePanel />);

    const input = screen.getByPlaceholderText('e.g. press key five') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'move up 5 cm' } });
    });

    expect(input.value).toBe('move up 5 cm');
    expect(useVoiceStore.getState().typedCommand).toBe('move up 5 cm');

    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(input.value).toBe('');
    expect(useVoiceStore.getState().typedCommand).toBe('');
  });

  it('changes state to requesting-permission when clicking Start Talking', async () => {
    let resolveGetUserMedia: (value: unknown) => void = () => {};
    const getUserMediaPromise = new Promise((resolve) => {
      resolveGetUserMedia = resolve;
    });
    (
      navigator.mediaDevices.getUserMedia as unknown as { mockReturnValue: (v: unknown) => void }
    ).mockReturnValue(getUserMediaPromise);

    render(<VoicePanel />);

    const startBtn = screen.getByRole('button', { name: 'Start Talking' });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    expect(useVoiceStore.getState().recordingStatus).toBe('requesting-permission');
    expect(screen.getByRole('button', { name: 'Requesting...' })).toBeDisabled();

    // Clean up by resolving
    await act(async () => {
      resolveGetUserMedia(new MockMediaStream());
    });
  });
});
