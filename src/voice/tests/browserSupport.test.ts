import { describe, it, expect, afterAll } from 'vitest';
import { checkBrowserSupport } from '../browserSupport';

describe('checkBrowserSupport', () => {
  const originalIsSecureContext = window.isSecureContext;
  const originalMediaRecorder = window.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;

  afterAll(() => {
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      configurable: true,
    });
    Object.defineProperty(window, 'MediaRecorder', {
      value: originalMediaRecorder,
      configurable: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
    });
  });

  it('should detect unsupported environment when mediaDevices are missing', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    Object.defineProperty(window, 'MediaRecorder', { value: class {}, configurable: true });

    const support = checkBrowserSupport();
    expect(support.supported).toBe(false);
    expect(support.reason).toContain('Microphone API is not available');
  });

  it('should detect unsupported environment when MediaRecorder is missing', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true,
    });
    Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true });

    const support = checkBrowserSupport();
    expect(support.supported).toBe(false);
    expect(support.reason).toContain('MediaRecorder API is not supported');
  });

  it('should detect unsupported environment in insecure contexts', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true,
    });
    Object.defineProperty(window, 'MediaRecorder', { value: class {}, configurable: true });

    const support = checkBrowserSupport();
    expect(support.supported).toBe(false);
    expect(support.reason).toContain('requires a secure context');
  });

  it('should pass in a fully compliant secure context', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true,
    });
    Object.defineProperty(window, 'MediaRecorder', { value: class {}, configurable: true });

    const support = checkBrowserSupport();
    expect(support.supported).toBe(true);
    expect(support.reason).toBeUndefined();
  });
});
