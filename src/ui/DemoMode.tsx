import { useEffect } from 'react';
import { useUiStore, type CameraPreset } from '../state/uiStore';

interface DemoStep {
  title: string;
  body: string;
  camera?: CameraPreset;
  advanced?: boolean;
}

/** Six-step judge walkthrough. Each step frames the relevant part of the UI. */
const STEPS: DemoStep[] = [
  {
    title: 'Digital Twin',
    body: 'A browser-first digital twin of the 6-DOF stylus arm, driven from the real URDF. Independent forward kinematics is verified live against the rendered tool centre point.',
    camera: 'overview',
  },
  {
    title: 'IK Preflight',
    body: 'A weighted damped-least-squares solver checks every key is reachable within position and tilt tolerances — off the main thread in a Web Worker. Enable Advanced to inspect per-key margins.',
    camera: 'pin',
    advanced: true,
  },
  {
    title: 'PIN Execution',
    body: 'Enter a six-digit PIN, run Preflight, then Execute. Every motion flows through the unified command → arbitration → safety → IK → trajectory pipeline as an autonomous source.',
    camera: 'tool',
  },
  {
    title: 'Safety Demonstration',
    body: 'E-STOP is out-of-band and always available in the top bar. It halts motion immediately, blocks manual and autonomous input, and requires an explicit reset before the robot can move again.',
    camera: 'overview',
  },
  {
    title: 'Replay & Evidence',
    body: 'The event timeline is a flight recorder of every command, plan, trajectory and rejection. PIN runs produce a per-key evidence table with position error and tilt, exportable as JSON/CSV.',
    camera: 'front',
  },
  {
    title: 'Hardware Architecture',
    body: 'An optional ESP32 transport is defined but disabled by default — the browser never drives servos directly. Simulation is the source of truth; hardware is a validated proof-of-concept.',
    camera: 'side',
  },
];

/**
 * Guided demo overlay. Presentation only: it nudges the camera preset and the
 * Advanced toggle per step but never touches the robot, runtime, or safety.
 */
export function DemoMode() {
  const step = useUiStore((s) => s.demoStep);
  const next = useUiStore((s) => s.nextDemo);
  const prev = useUiStore((s) => s.prevDemo);
  const exit = useUiStore((s) => s.exitDemo);
  const setCameraPreset = useUiStore((s) => s.setCameraPreset);
  const advancedMode = useUiStore((s) => s.advancedMode);
  const toggleAdvanced = useUiStore((s) => s.toggleAdvanced);

  const active = step !== null && step < STEPS.length;
  const current = active ? STEPS[step] : undefined;

  // Apply per-step framing (camera + advanced reveal) on entry.
  useEffect(() => {
    if (!current) return;
    if (current.camera) setCameraPreset(current.camera);
    if (current.advanced && !advancedMode) toggleAdvanced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Auto-close once we run past the last step.
  useEffect(() => {
    if (step !== null && step >= STEPS.length) exit();
  }, [step, exit]);

  if (!active || !current) return null;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="demo-overlay" role="dialog" aria-label="Guided demonstration">
      <div className="demo-card">
        <div className="demo-head">
          <span className="demo-step">
            Step {step + 1} / {STEPS.length}
          </span>
          <span className="demo-title">{current.title}</span>
          <button className="btn btn-ghost btn-xs demo-exit" onClick={exit} aria-label="Exit demo">
            Exit
          </button>
        </div>
        <p className="demo-body">{current.body}</p>
        <div className="demo-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`demo-dot${i <= step ? ' is-done' : ''}`} />
          ))}
        </div>
        <div className="demo-actions">
          <button className="btn btn-ghost btn-sm" onClick={prev} disabled={step === 0}>
            Back
          </button>
          <button className="btn btn-accent btn-sm" onClick={isLast ? exit : next}>
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
