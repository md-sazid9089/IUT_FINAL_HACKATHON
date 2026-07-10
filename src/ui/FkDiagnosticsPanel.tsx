import { useRobotStore } from '../state/robotStore';

const POSITION_TOL = 1e-4; // m
const ORIENTATION_TOL = 1e-4; // rad
const TOOL_AXIS_DOT_MIN = 0.999999;

function ok(pass: boolean): string {
  return pass ? 'ok' : 'fail';
}

/**
 * Live comparison between the independent FK engine and the rendered Three.js
 * TCP. This is the in-browser verification for Gate 2 — position, orientation,
 * and tool-axis agreement, with pass/fail against the acceptance tolerances.
 */
export function FkDiagnosticsPanel() {
  const diag = useRobotStore((s) => s.fkDiagnostics);
  const chain = useRobotStore((s) => s.chain);

  return (
    <section className="panel">
      <h2>FK verification</h2>
      <p className="muted small">Independent FK (gl-matrix) vs rendered Three.js TCP</p>

      {chain ? (
        <div className="readout">
          <div className="readout-label">Chain</div>
          <div className="readout-value mono">
            {chain.baseLink} → {chain.tipLink} ({chain.joints.length} joints)
          </div>
        </div>
      ) : null}

      {diag === null ? (
        <p className="muted">— awaiting first sample</p>
      ) : (
        <table className="joint-table">
          <thead>
            <tr>
              <th>metric</th>
              <th>value</th>
              <th>budget</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr className={diag.positionError <= POSITION_TOL ? '' : 'fail-row'}>
              <td>position (m)</td>
              <td className="mono">{diag.positionError.toExponential(2)}</td>
              <td className="mono">≤ 1e-4</td>
              <td>{ok(diag.positionError <= POSITION_TOL)}</td>
            </tr>
            <tr className={diag.orientationError <= ORIENTATION_TOL ? '' : 'fail-row'}>
              <td>orientation (rad)</td>
              <td className="mono">{diag.orientationError.toExponential(2)}</td>
              <td className="mono">≤ 1e-4</td>
              <td>{ok(diag.orientationError <= ORIENTATION_TOL)}</td>
            </tr>
            <tr className={diag.toolAxisDot >= TOOL_AXIS_DOT_MIN ? '' : 'fail-row'}>
              <td>tool-axis dot</td>
              <td className="mono">{diag.toolAxisDot.toFixed(9)}</td>
              <td className="mono">≥ 0.999999</td>
              <td>{ok(diag.toolAxisDot >= TOOL_AXIS_DOT_MIN)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
