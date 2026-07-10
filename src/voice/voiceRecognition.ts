/**
 * Microphone + Web Speech API wrapper (free, in-browser — no paid STT).
 * DOM-facing only: emits transcripts and status to the host; it knows nothing
 * about robots or commands.
 */

// ---- minimal ambient types (Web Speech API is not in lib.dom yet) ----------
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null;
}

export interface VoiceRecognitionEvents {
  /** Live (interim) transcript while the user is speaking. */
  onInterim?: (text: string) => void;
  /** Final transcript for one utterance. */
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onStateChange?: (listening: boolean) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow microphone use in the browser.',
  'no-speech': 'No speech detected — try again.',
  'audio-capture': 'No microphone found.',
  network: 'Speech service network error.',
  aborted: 'Listening stopped.',
};

export class VoiceRecognition {
  private recognition: SpeechRecognitionLike | null = null;
  private listening = false;
  private readonly events: VoiceRecognitionEvents;

  constructor(events: VoiceRecognitionEvents) {
    this.events = events;
  }

  isListening(): boolean {
    return this.listening;
  }

  start(lang = 'en-US'): void {
    if (this.listening) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.events.onError?.('Speech recognition is not supported in this browser (try Chrome/Edge).');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          const finalText = text.trim();
          if (finalText) this.events.onFinal(finalText);
        } else {
          interim += text;
        }
      }
      if (interim) this.events.onInterim?.(interim.trim());
    };
    rec.onerror = (e) => {
      this.events.onError?.(ERROR_MESSAGES[e.error] ?? `Speech error: ${e.error}`);
    };
    rec.onend = () => {
      this.listening = false;
      this.events.onStateChange?.(false);
    };
    this.recognition = rec;
    rec.start();
    this.listening = true;
    this.events.onStateChange?.(true);
  }

  stop(): void {
    this.recognition?.stop();
    this.listening = false;
    this.events.onStateChange?.(false);
  }

  dispose(): void {
    this.recognition?.abort();
    this.recognition = null;
    this.listening = false;
  }
}
