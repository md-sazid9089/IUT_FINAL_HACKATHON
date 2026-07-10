import { useRobotStore } from '../state/robotStore';

function fmt(n: number): string {
  return n.toFixed(4);
}

/**
 * Read-only telemetry: discovered joint metadata, live joint values, and the
 * rendered TCP world position. Also exposes a target-key selector (visualization
 * only — no motion in Gate 1).
 */
export function TelemetryPanel() {
  const jointMeta = useRobotStore((s) => s.jointMeta);
  const jointValues = useRobotStore((s) => s.jointValues);
  const tcp = useRobotStore((s) => s.tcp);
  const profile = useRobotStore((s) => s.profile);
  const targetKey = useRobotStore((s) => s.targetKey);
  const setTargetKey = useRobotStore((s) => s.setTargetKey);

  return (
    <section className="panel">
      <h2>Telemetry</h2>

      <div className="readout">
        <div className="readout-label">Profile</div>
        <div className="readout-value">{profile.label}</div>
      </div>

      <div className="readout">
        <div className="readout-label">TCP (base_link, m)</div>
        <div className="readout-value mono">
          x {fmt(tcp[0])} &nbsp; y {fmt(tcp[1])} &nbsp; z {fmt(tcp[2])}
        </div>
      </div>

      <div className="readout">
        <div className="readout-label">Target key (marker only)</div>
        <select
          className="readout-value"
          value={targetKey ?? ''}
          onChange={(e) => setTargetKey(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">none</option>
          {['1', '2', '3', '4', '5', '6'].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <h3>Joints ({jointMeta.length} discovered)</h3>
      <table className="joint-table">
        <thead>
          <tr>
            <th>name</th>
            <th>type</th>
            <th>value</th>
            <th>lower</th>
            <th>upper</th>
            <th>vel</th>
          </tr>
        </thead>
        <tbody>
          {jointMeta.map((m) => {
            const locked = m.name in profile.lockedJoints;
            return (
              <tr key={m.name} className={locked ? 'locked-row' : ''}>
                <td>
                  {m.name}
                  {locked ? ' 🔒' : ''}
                </td>
                <td>{m.type}</td>
                <td className="mono">{fmt(jointValues[m.name] ?? 0)}</td>
                <td className="mono">{fmt(m.lower)}</td>
                <td className="mono">{fmt(m.upper)}</td>
                <td className="mono">{fmt(m.velocity)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
