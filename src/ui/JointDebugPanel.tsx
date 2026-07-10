import { useRobotStore } from '../state/robotStore';

/**
 * TEMPORARY raw joint-debug sliders (Gate 1 only).
 *
 * These write directly to the store, which the RobotModel applies through the
 * RobotModelAdapter boundary. This panel exists ONLY to prove the digital twin
 * responds to joint changes and MUST BE REMOVED once the command/safety/runtime
 * pipeline lands (Gate 4/5). It bypasses no adapter boundary, but it is not a
 * legitimate long-term input path.
 */
export function JointDebugPanel() {
  const jointMeta = useRobotStore((s) => s.jointMeta);
  const jointValues = useRobotStore((s) => s.jointValues);
  const setJointValue = useRobotStore((s) => s.setJointValue);
  const profile = useRobotStore((s) => s.profile);

  return (
    <section className="panel">
      <h2>
        Joint debug <span className="temp-badge">TEMPORARY — remove in Gate 4/5</span>
      </h2>
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
                disabled={locked}
                onChange={(e) => setJointValue(m.name, Number(e.target.value))}
              />
              <span className="mono slider-value">{value.toFixed(3)}</span>
            </div>
          );
        })}
    </section>
  );
}
