import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import { getRuntime } from '../runtime/runtimeInstance';
import { manualJogGate, toDegrees } from './jogModel';

/**
 * Production joint-control panel (dashboard source).
 *
 * Each slider dispatches a validated `move_joints` command through the Gate 4
 * runtime — it never writes joints or the URDF directly. The panel shows the
 * commanded (current) value, the requested value, limits, radians, degrees and
 * the locked state for every revolute joint.
 */
export function JointControlPanel() {
  const jointMeta = useRobotStore((s) => s.jointMeta);
  const profile = useRobotStore((s) => s.profile);
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const jointValues = snapshot?.jointValues ?? {};
  const state = snapshot?.state ?? 'BOOTING';
  const activeSource = snapshot?.activeCommand?.source ?? null;
  // Disable joint edits only on a hard block (E-stop, fault, autonomous owner,
  // booting…). Manual-owned planning/executing keeps the sliders live.
  const disabled = manualJogGate(state, activeSource).status === 'blocked';

  function command(
    name: string,
    value: number,
  ) {
    getRuntime()?.submit({
      type: 'move_joints',
      source: 'dashboard',
      joints: {
        [name]: value,
      },
    });
  }

  const revolute = jointMeta.filter((m) => m.type === 'revolute');

  return (
    <section className="panel" aria-label="Manual joint controls">
      <h2>
        Manual joints <span className="temp-badge">dashboard → runtime</span>
      </h2>
      <p className="muted small">Each change is a validated command, not a direct joint write.</p>
      {jointMeta.length === 0 ? <p className="muted">Waiting for robot…</p> : null}

      {revolute.map((m) => {
        const locked = m.name in profile.lockedJoints;
        const current = jointValues[m.name] ?? (locked ? (profile.lockedJoints[m.name] ?? 0) : 0);
        const req = current;
        return (
          <div key={m.name} className="joint-control">
            <div className="joint-control-head">
              <label htmlFor={`joint-${m.name}`}>
                {m.name}
                {locked ? <span className="locked-tag"> 🔒 locked</span> : null}
              </label>
              <span className="mono small joint-deg">{toDegrees(current).toFixed(1)}°</span>
            </div>
            <input
              id={`joint-${m.name}`}
              type="range"
              min={m.lower}
              max={m.upper}
              step={0.001}
              value={req}
              disabled={locked || disabled}
              aria-label={`${m.name} target, ${m.lower.toFixed(3)} to ${m.upper.toFixed(3)} radians`}
              onChange={(e) => command(m.name, Number(e.target.value))}
            />
            <div className="joint-readout mono small">
              <span title="current commanded value">
                cur <b className="joint-cur">{current.toFixed(3)}</b> rad
              </span>
              <span title="requested target">
                req <b className="joint-req">{req.toFixed(3)}</b> rad
              </span>
              <span title="limits">
                [{m.lower.toFixed(3)}, {m.upper.toFixed(3)}]
              </span>
              <span title="degrees">
                {toDegrees(current).toFixed(1)}° / {toDegrees(req).toFixed(1)}°
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
