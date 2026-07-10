import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import { getRuntime } from '../runtime/runtimeInstance';

/**
 * Manual joint control (dashboard source).
 *
 * Sliders no longer touch the robot directly. Each change submits a validated
 * `move_joints` command through the RuntimeController, which arbitrates,
 * safety-checks, plans a trajectory, and drives the adapter. This is the only
 * way this panel can move the robot.
 */
export function JointDebugPanel() {
  const jointMeta = useRobotStore((s) => s.jointMeta);
  const profile = useRobotStore((s) => s.profile);
  const snapshot = useRuntimeStore((s) => s.snapshot);
  const jointValues = snapshot?.jointValues ?? {};
  const state = snapshot?.state ?? 'BOOTING';
  const disabled = state !== 'READY' && state !== 'EXECUTING';

  function command(name: string, value: number) {
    getRuntime()?.submit({ type: 'move_joints', source: 'dashboard', joints: { [name]: value } });
  }

  return (
    <section className="panel">
      <h2>
        Manual joints <span className="temp-badge">dashboard → runtime</span>
      </h2>
      <p className="muted small">Slider changes are validated commands, not direct joint writes.</p>
      {jointMeta.length === 0 ? <p className="muted">Waiting for robot…</p> : null}
      {jointMeta
        .filter((m) => m.type === 'revolute')
        .map((m) => {
          const locked = m.name in profile.lockedJoints;
          const value = jointValues[m.name] ?? 0;
          return (
            <div key={m.name} className="slider-row">
              <label htmlFor={`slider-${m.name}`}>
                {m.name}
                {locked ? ' 🔒 locked' : ''}
              </label>
              <input
                id={`slider-${m.name}`}
                type="range"
                min={m.lower}
                max={m.upper}
                step={0.001}
                value={value}
                disabled={locked || disabled}
                onChange={(e) => command(m.name, Number(e.target.value))}
              />
              <span className="mono slider-value">{value.toFixed(3)}</span>
            </div>
          );
        })}
    </section>
  );
}
