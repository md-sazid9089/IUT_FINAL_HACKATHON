import { useRuntimeStore } from '../state/runtimeStore';
import { getRuntime } from '../runtime/runtimeInstance';
import { StatusChip, toneForState } from './StatusChip';

const LIVE = new Set(['EXECUTING', 'PLANNING', 'STOPPING']);

/**
 * Runtime & motion supervisor: live state and the motion control verbs. Every
 * button submits through the RuntimeController — E-stop is out of band. The
 * event stream is shown in the bottom EventTimeline.
 */
export function RuntimePanel() {
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const state = snapshot?.state ?? 'BOOTING';

  const estop = () => getRuntime()?.emergencyStop();
  const submit = (type: string) => getRuntime()?.submit({ type, source: 'system' });

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Runtime &amp; Motion</h2>
      </div>

      <div className="runtime-state-row">
        <StatusChip label={state} tone={toneForState(state)} pulse={LIVE.has(state)} />
        <span className="runtime-active mono">
          {snapshot?.activeCommand
            ? `${snapshot.activeCommand.type} · ${snapshot.activeCommand.source}`
            : 'idle'}
          {` · q${snapshot?.queueLength ?? 0}`}
        </span>
      </div>

      <div className="btn-row">
        <button className="btn btn-danger" onClick={estop}>
          E-STOP
        </button>
        <button className="btn" onClick={() => getRuntime()?.resetEStop()} disabled={!snapshot?.eStopped}>
          Reset
        </button>
      </div>
      <div className="btn-row">
        <button className="btn btn-sm" onClick={() => submit('stop')}>
          Stop
        </button>
        <button className="btn btn-sm" onClick={() => submit('pause')}>
          Pause
        </button>
        <button className="btn btn-sm" onClick={() => submit('resume')}>
          Resume
        </button>
      </div>

      {snapshot?.lastRejection ? (
        <p className="inline-alert" role="alert">
          {snapshot.lastRejection}
        </p>
      ) : null}
    </section>
  );
}
