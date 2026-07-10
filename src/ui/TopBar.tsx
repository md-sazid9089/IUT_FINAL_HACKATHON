import { getRuntime } from '../runtime/runtimeInstance';
import { useRuntimeStore } from '../state/runtimeStore';
import { useRobotStore } from '../state/robotStore';
import { useHardwareStore } from '../hardware/hardwareStore';
import { useUiStore } from '../state/uiStore';
import { StatusChip, toneForState } from './StatusChip';

const LIVE_STATES = new Set(['EXECUTING', 'PLANNING', 'STOPPING']);

/**
 * Persistent mission-control top bar: identity, connection, runtime state,
 * safety, and an always-available E-STOP, plus Advanced/Demo toggles. Reads
 * throttled snapshots only — no runtime state is held in React here.
 */
export function TopBar() {
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const status = useRobotStore((s) => s.status);
  const profile = useRobotStore((s) => s.profile);
  const hw = useHardwareStore((s) => s.status);
  const advanced = useUiStore((s) => s.advancedMode);
  const toggleAdvanced = useUiStore((s) => s.toggleAdvanced);
  const startDemo = useUiStore((s) => s.startDemo);
  const demoActive = useUiStore((s) => s.demoStep !== null);

  const state = snapshot?.state ?? 'BOOTING';
  const eStopped = snapshot?.eStopped ?? false;
  const online = status === 'ready';

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div className="brand-text">
          <h1>stylus_arm</h1>
          <span className="brand-sub">Robotic Control System</span>
        </div>
      </div>

      <div className="topbar-metrics">
        <div className="metric">
          <span className="metric-label">Robot</span>
          <span className="metric-value">{profile.label.split(' (')[0]}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Connection</span>
          <StatusChip
            size="sm"
            label={online ? 'Simulation' : status === 'error' ? 'Fault' : 'Linking…'}
            tone={online ? 'ok' : status === 'error' ? 'danger' : 'idle'}
          />
        </div>
        <div className="metric">
          <span className="metric-label">Hardware</span>
          <StatusChip
            size="sm"
            label={hw.mode === 'hardware-disabled' ? 'Disabled' : hw.state}
            tone={hw.mode === 'hardware-disabled' ? 'idle' : 'ok'}
            title="ESP32 transport is optional and disabled by default"
          />
        </div>
        <div className="metric">
          <span className="metric-label">Runtime</span>
          <StatusChip label={state} tone={toneForState(state)} pulse={LIVE_STATES.has(state)} />
        </div>
        <div className="metric">
          <span className="metric-label">Safety</span>
          <StatusChip
            label={eStopped ? 'E-STOPPED' : state === 'FAULT' ? 'FAULT' : 'Nominal'}
            tone={eStopped || state === 'FAULT' ? 'danger' : 'ok'}
            pulse={eStopped}
          />
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className={`btn btn-ghost btn-sm${advanced ? ' is-on' : ''}`}
          aria-pressed={advanced}
          onClick={toggleAdvanced}
          title="Show engineering diagnostics (FK / IK preflight)"
        >
          Advanced
        </button>
        <button
          className={`btn btn-accent btn-sm${demoActive ? ' is-on' : ''}`}
          onClick={startDemo}
          title="Guided judge walkthrough"
        >
          Demo Mode
        </button>
        <button
          className="btn btn-danger btn-estop"
          onClick={() => getRuntime()?.emergencyStop()}
          title="Emergency stop — out-of-band, halts all motion"
        >
          E-STOP
        </button>
      </div>
    </header>
  );
}
