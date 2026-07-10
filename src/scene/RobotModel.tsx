import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { URDFRobot } from 'urdf-loader';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import type { Vec3Tuple } from './coordinates';
import { extractChain } from '../kinematics/extractChain';
import type { KinematicChain } from '../kinematics/chainTypes';
import { computeForwardKinematics, toolAxisFromPose } from '../kinematics/forwardKinematics';
import { comparePoses } from '../kinematics/metrics';
import { RuntimeController, type Vec3 } from '../runtime/RuntimeController';
import { setRuntime } from '../runtime/runtimeInstance';
import { IkWorkerClient } from '../kinematics/ikWorkerClient';

const URDF_URL = '/robot/6_dof_arm.urdf';
const TCP_EPS = 1e-6;

/**
 * Loads the URDF, then hands the adapter to the RuntimeController. From this
 * point the runtime is the ONLY thing that commands joint values (via
 * adapter.setJointValues). React only ticks the runtime and reads the rendered
 * TCP for telemetry — it never sets joints directly.
 */
export function RobotModel() {
  const adapterRef = useRef(new RobotModelAdapter());
  const chainRef = useRef<KinematicChain | null>(null);
  const runtimeRef = useRef<RuntimeController | null>(null);
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const lastTcp = useRef<Vec3Tuple | null>(null);

  const setStatus = useRobotStore((s) => s.setStatus);
  const setJointMeta = useRobotStore((s) => s.setJointMeta);
  const setTcp = useRobotStore((s) => s.setTcp);
  const setChain = useRobotStore((s) => s.setChain);
  const setFkDiagnostics = useRobotStore((s) => s.setFkDiagnostics);

  useEffect(() => {
    let cancelled = false;
    const adapter = adapterRef.current;
    setStatus('loading');
    adapter
      .loadFromUrl(URDF_URL)
      .then((loaded) => {
        if (cancelled) return;
        const meta = adapter.getJointMetadata();
        setJointMeta(meta);
        const chain = extractChain(loaded, adapter.baseLinkName, adapter.tcpLinkName);
        chainRef.current = chain;
        setChain(chain);
        setRobot(loaded);
        loaded.updateMatrixWorld(true);

        // Build the runtime around the adapter (the only URDF setter path).
        const profile = useRobotStore.getState().profile;
        const initialJoints: Record<string, number> = {};
        for (const m of meta) initialJoints[m.name] = profile.lockedJoints[m.name] ?? 0;

        // Cartesian planning via the Gate 3 IK worker (lazy init).
        let ikClient: IkWorkerClient | null = null;
        let ikReady: Promise<void> | null = null;
        const ikSolve = async (position: Vec3, approachAxis: Vec3) => {
          if (!ikClient) {
            ikClient = new IkWorkerClient();
            ikReady = ikClient.init(chain);
          }
          await ikReady;
          return ikClient.solveIk({
            target: { position, approachAxis },
            activeJoints: profile.activeJoints,
            lockedValues: profile.lockedJoints,
          });
        };

        const controller = new RuntimeController({
          jointMeta: meta,
          profile,
          initialJoints,
          applyJoints: (values) => adapter.setJointValues(values),
          ikSolve,
          publish: (snapshot) => useRuntimeStore.getState().setSnapshot(snapshot),
          snapshotHz: 15,
        });
        runtimeRef.current = controller;
        setRuntime(controller);
        controller.bringOnline();

        const initial = adapter.getTcpWorldPosition();
        lastTcp.current = initial;
        setTcp(initial);
        publishDiagnostics();
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error', err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      setRuntime(null);
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStatus, setJointMeta, setTcp, setChain, setFkDiagnostics]);

  /** Compare independent FK against the rendered Three.js pose and publish it. */
  function publishDiagnostics() {
    const chain = chainRef.current;
    const controller = runtimeRef.current;
    if (!chain || !controller) return;
    const fk = computeForwardKinematics(chain, controller.getJointValues());
    const cmp = comparePoses(
      fk.tcp.position,
      adapterRef.current.getTcpWorldPosition(),
      fk.tcp.quaternion,
      adapterRef.current.getTcpWorldQuaternion(),
      toolAxisFromPose(fk.tcp),
      adapterRef.current.getTcpWorldToolAxis(),
    );
    setFkDiagnostics(cmp);
  }

  useFrame((_, delta) => {
    const controller = runtimeRef.current;
    if (!robot || !controller) return;
    // Drive the runtime; it applies joint values to the adapter this tick.
    controller.tick(Math.min(delta * 1000, 100));
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
      publishDiagnostics();
    }
  });

  if (!robot) return null;
  return <primitive object={robot} />;
}
