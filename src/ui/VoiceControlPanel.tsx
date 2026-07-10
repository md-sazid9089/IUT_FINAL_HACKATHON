import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRuntime } from '../runtime/runtimeInstance';
import { useRuntimeStore } from '../state/runtimeStore';
import { useRobotStore } from '../state/robotStore';
import { usePinStore } from '../pin/pinStore';
import { StatusChip, type ChipTone } from './StatusChip';
import {
  parseVoice,
  preferredProvider,
  readAiConfig,
  type AiProvider,
  type ParseOutcome,
} from '../voice/voiceAIParser';
import {
  mapVoiceCommand,
  type RuntimeSubmission,
} from '../voice/voiceCommandMapper';
import {
  speechRecognitionSupported,
  VoiceRecognition,
} from '../voice/voiceRecognition';

type Phase = 'idle' | 'listening' | 'processing' | 'approved' | 'executing' | 'rejected';

interface VoiceEntry {
  readonly id: number;
  readonly transcript: string;
  readonly phase: Phase;
  readonly description?: string;
  readonly reason?: string;
  readonly provider?: AiProvider;
}

const PHASE_TONE: Record<Phase, ChipTone> = {
  idle: 'idle',
  listening: 'active',
  processing: 'active',
  approved: 'ok',
  executing: 'active',
  rejected: 'danger',
};

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Idle',
  listening: 'Listening',
  processing: 'Processing',
  approved: 'Approved',
  executing: 'Executing',
  rejected: 'Rejected',
};

let nextId = 1;

/**
 * Voice Control panel — one operator-visible surface for the whole voice stack.
 *
 * Pipeline (matches the schema in src/voice):
 *   microphone  →  Web Speech API transcript
 *              →  offline rule parser (Zod)  |  Gemini/Grok  (Zod)
 *              →  command mapper  →  RuntimeController.submit  →  robot
 *
 * The AI never touches the robot: only Zod-validated commands leave this panel,
 * and even then they flow through the same safety pipeline as the joystick,
 * keyboard, and PIN sources. Unclear utterances surface as a clarification
 * request instead of moving the arm.
 */
export function VoiceControlPanel() {
  const supported = useMemo(speechRecognitionSupported, []);
  const cfg = useMemo(readAiConfig, []);
  const provider = useMemo(() => preferredProvider(cfg), [cfg]);

  const [phase, setPhase] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<VoiceRecognition | null>(null);

  const snapshot = useRuntimeStore((s) => s.snapshot);
  const toolAxis = useRobotStore((s) => s.toolAxis);
  const setPinInput = usePinStore((s) => s.setPin);

  const submitToRuntime = useCallback(
    (submission: RuntimeSubmission, entryId: number, prov: AiProvider) => {
      const patch = (p: Partial<VoiceEntry>) =>
        setEntries((list) => list.map((e) => (e.id === entryId ? { ...e, ...p } : e)));

      if (submission.kind === 'clarify') {
        patch({ phase: 'rejected', reason: submission.message, description: 'Clarification requested' });
        return;
      }
      if (submission.kind === 'rejected') {
        patch({ phase: 'rejected', reason: submission.reason });
        return;
      }
      if (submission.kind === 'pin') {
        setPinInput(submission.pin);
        patch({
          phase: 'approved',
          description: `${submission.description} · use PIN panel to Preflight & Execute`,
        });
        return;
      }
      const runtime = getRuntime();
      if (!runtime) {
        patch({ phase: 'rejected', reason: 'Runtime not ready' });
        return;
      }
      const res = runtime.submit(submission.command);
      if (!res.accepted) {
        patch({ phase: 'rejected', reason: res.reason ?? 'Runtime rejected the command' });
        return;
      }
      patch({ phase: 'executing', description: submission.description, provider: prov });
    },
    [setPinInput],
  );

  const process = useCallback(
    async (transcript: string) => {
      setInterim('');
      const id = nextId++;
      const newEntry: VoiceEntry = { id, transcript, phase: 'processing' };
      setEntries((list) => [newEntry, ...list].slice(0, 8));
      setPhase('processing');

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      let outcome: ParseOutcome;
      try {
        outcome = await parseVoice(transcript, cfg, { signal: abortRef.current.signal });
      } catch (err) {
        outcome = {
          provider: 'offline',
          rawText: transcript,
          result: { ok: false, error: err instanceof Error ? err.message : String(err) },
        };
      }

      if (!outcome.result.ok || !outcome.result.command) {
        setEntries((list) =>
          list.map((e) =>
            e.id === id
              ? { ...e, phase: 'rejected', reason: outcome.result.error, provider: outcome.provider }
              : e,
          ),
        );
        setPhase('idle');
        return;
      }

      setEntries((list) =>
        list.map((e) => (e.id === id ? { ...e, phase: 'approved', provider: outcome.provider } : e)),
      );

      const jointValues = snapshot?.jointValues ?? {};
      const axis: readonly [number, number, number] = toolAxis ?? [0, 0, -1];
      const submission = mapVoiceCommand(outcome.result.command, {
        jointValues,
        approachAxis: axis,
      });
      submitToRuntime(submission, id, outcome.provider);
      setPhase('idle');
    },
    [cfg, snapshot?.jointValues, toolAxis, submitToRuntime],
  );

  // Lazy-init the recognizer on first use so the hook stays cheap.
  const getRecognizer = useCallback((): VoiceRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;
    if (!supported) return null;
    recognitionRef.current = new VoiceRecognition({
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        setInterim('');
        void process(t);
      },
      onError: (m) => {
        setError(m);
        setPhase('idle');
      },
      onStateChange: (listening) => setPhase(listening ? 'listening' : 'idle'),
    });
    return recognitionRef.current;
  }, [process, supported]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      recognitionRef.current?.dispose();
      recognitionRef.current = null;
    },
    [],
  );

  const startListening = () => {
    setError(null);
    getRecognizer()?.start();
  };
  const stopListening = () => recognitionRef.current?.stop();

  const providerBadge =
    provider === 'gemini' ? 'Gemini' : provider === 'grok' ? 'Grok' : 'Offline rules';
  const providerTone: ChipTone = provider === 'offline' ? 'idle' : 'ok';

  return (
    <section className="panel voice-panel" aria-label="Voice control">
      <div className="panel-head">
        <h2>Voice Control</h2>
        <StatusChip size="sm" label={providerBadge} tone={providerTone} title={`AI provider: ${providerBadge}`} />
      </div>
      <p className="muted small">
        Speak natural commands. Every utterance is validated and routed through the same safety
        pipeline as the joystick and PIN sources — the AI never drives the robot directly.
      </p>

      {!supported ? (
        <p className="inline-alert">
          Speech recognition is not supported in this browser. Try Chrome, Edge, or another
          Chromium-based browser.
        </p>
      ) : null}

      <div className="btn-row">
        <button
          className={`btn btn-accent${phase === 'listening' ? ' is-on' : ''}`}
          onClick={phase === 'listening' ? stopListening : startListening}
          disabled={!supported}
          aria-pressed={phase === 'listening'}
        >
          {phase === 'listening' ? '■ Stop' : '🎤 Start Listening'}
        </button>
        <StatusChip label={PHASE_LABEL[phase]} tone={PHASE_TONE[phase]} pulse={phase === 'listening' || phase === 'executing'} />
      </div>

      <div className="readout">
        <div className="readout-label">Live transcript</div>
        <div className="readout-value mono voice-live">
          {phase === 'listening' && interim ? interim : phase === 'listening' ? '…' : '—'}
        </div>
      </div>

      {error ? <p className="inline-alert" role="alert">{error}</p> : null}

      <h3>History</h3>
      {entries.length === 0 ? (
        <p className="muted small">Say something like <em>“move down 5 centimetres”</em> or <em>“go home”</em>.</p>
      ) : (
        <ol className="voice-history">
          {entries.map((e) => (
            <li key={e.id} className={`voice-entry voice-${e.phase}`}>
              <div className="voice-entry-head">
                <StatusChip size="sm" label={PHASE_LABEL[e.phase]} tone={PHASE_TONE[e.phase]} />
                {e.provider ? <span className="voice-provider small">via {e.provider}</span> : null}
              </div>
              <div className="voice-transcript small">“{e.transcript}”</div>
              {e.description ? <div className="voice-desc mono small">{e.description}</div> : null}
              {e.reason ? <div className="voice-reason small">{e.reason}</div> : null}
            </li>
          ))}
        </ol>
      )}

      <h3>Try saying</h3>
      <ul className="key-help small mono">
        <li>“move down 5 centimeters”</li>
        <li>“move right”</li>
        <li>“rotate joint 2 by 30 degrees”</li>
        <li>“go home”</li>
        <li>“stop”</li>
        <li>“enter pin 123456”</li>
      </ul>
    </section>
  );
}
