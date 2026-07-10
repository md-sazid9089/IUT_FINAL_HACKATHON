import { useEffect, useRef, useState } from 'react';
import { useRobotStore } from '../state/robotStore';
import { IkWorkerClient } from '../kinematics/ikWorkerClient';
import type { PreflightRequest, PreflightResult } from '../kinematics/preflight';
import { approachUnitVector, type Vec3Tuple } from '../scene/coordinates';
import type { KeyConfig } from '../config/keyConfig';

// Judged production profile: six active arm joints; stylus_pitch locked at 0.
const ACTIVE_6DOF = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
const LOCKED_6DOF = { stylus_pitch: 0 };
const RAD2DEG = 180 / Math.PI;

interface Props {
  keyConfig: KeyConfig | null;
}

/**
 * Development diagnostics: run the key-reachability preflight through the IK
 * worker for the required competition_6dof profile (stylus_pitch locked = 0).
 * Off the main thread; supports cancellation.
 */
export function IkPreflightPanel({ keyConfig }: Props) {
  const chain = useRobotStore((s) => s.chain);
  const clientRef = useRef<IkWorkerClient | null>(null);
  const runIdRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PreflightResult | 'cancelled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  async function run() {
    if (!chain || !keyConfig) return;
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      if (!clientRef.current) clientRef.current = new IkWorkerClient();
      const client = clientRef.current;
      await client.init(chain);

      const keys: Record<string, Vec3Tuple> = {};
      for (const [id, c] of Object.entries(keyConfig.keys)) keys[id] = [c.x, c.y, c.z];
      const request: PreflightRequest = {
        keys,
        approachAxis: approachUnitVector(keyConfig.approach_axis),
        activeJoints: ACTIVE_6DOF,
        lockedValues: LOCKED_6DOF,
        hoverDistance: 0.05,
        descentSteps: 4,
      };
      const { id, promise } = client.preflight(request);
      runIdRef.current = id;
      const outcome = await promise;
      setResult(outcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      runIdRef.current = null;
    }
  }

  function cancel() {
    if (clientRef.current && runIdRef.current !== null) {
      clientRef.current.cancel(runIdRef.current);
    }
  }

  return (
    <section className="panel">
      <h2>IK preflight</h2>
      <p className="muted small">
        Required profile: <strong>competition_6dof</strong> · stylus_pitch locked = 0
      </p>

      <div className="slider-row">
        <button onClick={run} disabled={running || !chain || !keyConfig}>
          {running ? 'Running…' : 'Run preflight'}
        </button>
        {running ? <button onClick={cancel}>Cancel</button> : null}
      </div>

      {error ? <p className="fail-row small">{error}</p> : null}
      {result === 'cancelled' ? <p className="muted small">Cancelled.</p> : null}

      {result && result !== 'cancelled' ? (
        <>
          <p className="small">
            All reachable:{' '}
            <span className={result.allReachable ? '' : 'fail-row'}>
              {result.allReachable ? 'yes' : 'no'}
            </span>
          </p>
          <table className="joint-table">
            <thead>
              <tr>
                <th>key</th>
                <th>H/D/C/R</th>
                <th>pos (m)</th>
                <th>tilt°</th>
                <th>Δq</th>
                <th>lim</th>
              </tr>
            </thead>
            <tbody>
              {result.keys.map((k) => (
                <tr key={k.key} className={k.reachable ? '' : 'fail-row'}>
                  <td>{k.key}</td>
                  <td className="mono">
                    {[k.hoverSuccess, k.descentSuccess, k.contactSuccess, k.retractSuccess]
                      .map((s) => (s ? '✓' : '✗'))
                      .join('')}
                  </td>
                  <td className="mono">{k.worstPositionError.toExponential(1)}</td>
                  <td className="mono">{(k.worstTiltRad * RAD2DEG).toFixed(1)}</td>
                  <td className="mono">{k.maxJointDelta.toFixed(2)}</td>
                  <td className="mono">{k.minJointLimitMargin.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">H/D/C/R = hover · descent · contact · retract</p>
        </>
      ) : null}
    </section>
  );
}
