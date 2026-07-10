export interface VoiceBrowserSupport {
  secureContext: boolean;
  mediaDevicesAvailable: boolean;
  getUserMediaAvailable: boolean;
  mediaRecorderAvailable: boolean;
  supported: boolean;
  reason?: string;
}

export function checkBrowserSupport(): VoiceBrowserSupport {
  const secureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
  const mediaDevicesAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices;
  const getUserMediaAvailable =
    mediaDevicesAvailable && typeof navigator.mediaDevices.getUserMedia === 'function';
  const mediaRecorderAvailable =
    typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  const supported =
    mediaDevicesAvailable && getUserMediaAvailable && mediaRecorderAvailable && secureContext;

  let reason: string | undefined;
  if (!supported) {
    if (!mediaDevicesAvailable || !getUserMediaAvailable) {
      reason = 'Microphone API is not available or disabled in this browser.';
    } else if (!mediaRecorderAvailable) {
      reason = 'MediaRecorder API is not supported by this browser.';
    } else if (!secureContext) {
      reason = 'Microphone access requires a secure context (HTTPS/localhost).';
    } else {
      reason = 'Browser does not support voice recording.';
    }
  }

  return {
    secureContext,
    mediaDevicesAvailable,
    getUserMediaAvailable,
    mediaRecorderAvailable,
    supported,
    reason,
  };
}
