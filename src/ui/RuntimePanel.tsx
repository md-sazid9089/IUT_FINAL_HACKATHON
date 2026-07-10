import { useRuntimeStore } from '../state/runtimeStore';
import { getRuntime } from '../runtime/runtimeInstance';

const STATE_COLORS: Record<string, string> = {
  READY: '#a3be8c',
  EXECUTING: '#88c0d0',
  PLANNING: '#ebcb8b',
  PAUSED: '#ebcb8b',
  STOPPING: '#d08770',
  E_STOPPED: '#bf616a',
  FAULT: '#bf616a',
};

/**
 * Runtime supervisor panel: live state, motion controls, and event log. Every
 * button submits a command through the RuntimeController — E-stop is out of band.
 */
export function RuntimePanel() {
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const state = snapshot?.state ?? 'BOOTING';
  const color = STATE_COLORS[state] ?? '#9aa5b1';

  const estop = () => getRuntime()?.emergencyStop();
  const submit = (type: string) => getRuntime()?.submit({ type, source: 'system' });

  return (
    <section className="panel">
      <h2>Runtime</h2>

      <div className="readout">
        <div className="readout-label">State</div>
        <div className="readout-value">
          <span className="state-badge" style={{ background: color }}>
            {state}
          </span>
          {snapshot?.eStopped ? <span className="fail-row"> · E-STOPPED</span> : null}
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">Active / queue</div>
        <div className="readout-value mono">
          {snapshot?.activeCommand ? `${snapshot.activeCommand.type} (${snapshot.activeCommand.source})` : '—'}
          {' · q='}
          {snapshot?.queueLength ?? 0}
        </div>
      </div>

      <div className="button-row">
        <button className="estop-btn" onClick={estop}>
          E-STOP
        </button>
        <button onClick={() => getRuntime()?.resetEStop()} disabled={!snapshot?.eStopped}>
          Reset
        </button>
      </div>
      <div className="button-row">
        <button onClick={() => submit('stop')}>Stop</button>
        <button onClick={() => submit('pause')}>Pause</button>
        <button onClick={() => submit('resume')}>Resume</button>
      </div>

      {snapshot?.lastRejection ? (
        <p className="fail-row small">Last rejection: {snapshot.lastRejection}</p>
      ) : null}

      <h3>Events</h3>
      <div className="event-log mono">
        {(snapshot?.events ?? [])
          .slice(-10)
          .reverse()
          .map((e) => (
            <div key={e.seq} className={`event-${e.level}`}>
              [{e.kind}] {e.message}
            </div>
          ))}
      </div>
    </section>
  );
}
