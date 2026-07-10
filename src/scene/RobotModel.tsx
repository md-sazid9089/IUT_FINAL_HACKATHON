import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { URDFRobot } from 'urdf-loader';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { useRobotStore } from '../state/robotStore';

const URDF_URL = '/robot/6_dof_arm.urdf';
const TCP_EPS = 1e-6;

/**
 * Loads the URDF through the RobotModelAdapter and renders it. Joint values flow
 * from the store → adapter (the adapter is the only URDF setter boundary). The
 * rendered TCP world position is read back each frame and published to the store.
 */
export function RobotModel() {
  const adapterRef = useRef(new RobotModelAdapter());
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const lastTcp = useRef<[number, number, number]>([NaN, NaN, NaN]);

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
    adapterRef.current.setJointValues(jointValues);
    const [x, y, z] = adapterRef.current.getTcpWorldPosition();
    const [px, py, pz] = lastTcp.current;
    if (Math.abs(px - x) > TCP_EPS || Math.abs(py - y) > TCP_EPS || Math.abs(pz - z) > TCP_EPS) {
      lastTcp.current = [x, y, z];
      setTcp([x, y, z]);
    }
  });

  if (!robot) return null;
  return <primitive object={robot} />;
}
