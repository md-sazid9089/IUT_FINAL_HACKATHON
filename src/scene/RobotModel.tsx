import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { URDFRobot } from 'urdf-loader';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { useRobotStore } from '../state/robotStore';
import type { Vec3Tuple } from './coordinates';

const URDF_URL = '/robot/6_dof_arm.urdf';
const TCP_EPS = 1e-6;

/**
 * Loads the URDF through the RobotModelAdapter and renders it. Joint values flow
 * from the store → adapter (the adapter is the only URDF setter boundary). The
 * rendered TCP world position is read back and published to the store: once
 * immediately after load, then whenever it changes during animation.
 */
export function RobotModel() {
  const adapterRef = useRef(new RobotModelAdapter());
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const lastTcp = useRef<Vec3Tuple | null>(null);

  const setStatus = useRobotStore((s) => s.setStatus);
  const setJointMeta = useRobotStore((s) => s.setJointMeta);
  const setTcp = useRobotStore((s) => s.setTcp);

  useEffect(() => {
    let cancelled = false;
    const adapter = adapterRef.current;
    setStatus('loading');
    adapter
      .loadFromUrl(URDF_URL)
      .then((loaded) => {
        if (cancelled) return;
        setJointMeta(adapter.getJointMetadata());
        setRobot(loaded);
        // Force world matrices to update, then publish the first real TCP sample
        // immediately — do not wait for a joint change.
        loaded.updateMatrixWorld(true);
        const initial = adapter.getTcpWorldPosition();
        lastTcp.current = initial;
        setTcp(initial);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error', err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [setStatus, setJointMeta, setTcp]);

  useFrame(() => {
    if (!robot) return;
    const { jointValues } = useRobotStore.getState();
    // apply current joint values → update world matrices → read TCP → publish.
    adapterRef.current.setJointValues(jointValues);
    const next = adapterRef.current.getTcpWorldPosition();
    const prev = lastTcp.current;
    if (
      prev === null ||
      Math.abs(prev[0] - next[0]) > TCP_EPS ||
      Math.abs(prev[1] - next[1]) > TCP_EPS ||
      Math.abs(prev[2] - next[2]) > TCP_EPS
    ) {
      lastTcp.current = next;
      setTcp(next);
    }
  });

  if (!robot) return null;
  return <primitive object={robot} />;
}
