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
import { PREFERRED_MANUAL_POSTURE } from '../manual/cartesianMotionController';

const URDF_URL = '/robot/6_dof_arm.urdf';
const TCP_EPS = 1e-6;
/** Cap for pushing telemetry/diagnostics into React (~30 Hz). */
const TELEMETRY_INTERVAL_MS = 33;

/**
 * Visual-only material pass: enables shadows and gives the URDF meshes a clean,
 * semi-matte industrial finish. Geometry is never modified, and metalness is
 * kept low so surfaces read correctly without an environment map.
 */
function enhanceRobotMaterials(robot: URDFRobot): void {
  robot.traverse((obj) => {
    const mesh = obj as unknown as { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean; material?: unknown };
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const apply = (m: unknown) => {
      const mat = m as { metalness?: number; roughness?: number; envMapIntensity?: number; needsUpdate?: boolean };
      if (mat && typeof mat.metalness === 'number') {
        mat.metalness = 0.25;
        mat.roughness = 0.5;
        mat.envMapIntensity = 0.9;
        mat.needsUpdate = true;
      }
    };
    if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
    else apply(mesh.material);
  });
}

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
  // Telemetry (TCP/tool-axis/FK diagnostics) is pushed to React at a capped rate
  // so per-frame store writes and FK math never compete with the 60 fps render
  // loop. The robot itself still ticks and renders every frame — motion stays
  // perfectly smooth; only the on-screen numbers refresh at ~33 Hz.
  const telemetryAccumMs = useRef(0);

  const setStatus = useRobotStore((s) => s.setStatus);
  const setJointMeta = useRobotStore((s) => s.setJointMeta);
  const setTcp = useRobotStore((s) => s.setTcp);
  const setToolAxis = useRobotStore((s) => s.setToolAxis);
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
        enhanceRobotMaterials(loaded);

        // Build the runtime around the adapter (the only URDF setter path).
        const profile = useRobotStore.getState().profile;
        const initialJoints: Record<string, number> = {};
        for (const m of meta) initialJoints[m.name] = profile.lockedJoints[m.name] ?? 0;

        // Cartesian planning via the Gate 3 IK worker (lazy init). The runtime
        // passes the CURRENT joints as the warm-start seed so successive jog
        // steps stay on the same IK branch (continuous, natural motion). The
        // preferred manual posture biases the null space toward a bent-elbow
        // pose instead of a stretched, near-singular arm.
        //
        // Two-stage solve: a FAST pass (warm-start seed, few iterations) covers
        // virtually every continuous jog step; if it fails, ONE thorough pass
        // (full seed set + iteration budget) runs before reporting failure —
        // so reachable targets never surface as "diverged" just because the
        // fast path gave up early.
        let ikClient: IkWorkerClient | null = null;
        let ikReady: Promise<void> | null = null;
        const ikSolve = async (position: Vec3, approachAxis: Vec3, seed?: Readonly<Record<string, number>>) => {
          if (!ikClient) {
            ikClient = new IkWorkerClient();
            ikReady = ikClient.init(chain);
          }
          await ikReady;
          const base = {
            target: { position, approachAxis },
            activeJoints: profile.activeJoints,
            lockedValues: profile.lockedJoints,
            ...(seed ? { seed } : {}),
          };
          const shared = {
            postureReference: PREFERRED_MANUAL_POSTURE,
            // Boundary sliding: a tangent step at full reach lands a fraction
            // of a millimetre outside the workspace sphere. The strict 0.1 mm
            // tolerance would reject it and the arm would appear "stuck".
            // 1.5 mm accepts the nearest reachable point so the TCP glides
            // along the boundary; interior jogs still converge far tighter.
            positionTolerance: 1.5e-3,
            // Jogs pass the CURRENT tool axis (tilt starts near 0°); a relaxed
            // early-exit tilt lets warm-started solves finish in a few
            // iterations. maxTiltRad still hard-gates acceptance.
            preferredTiltRad: (10 * Math.PI) / 180,
          };
          const fast = await ikClient.solveIk({
            ...base,
            options: { ...shared, maxIterations: 120, seedCandidates: 2 },
          });
          if (fast.verified) return fast;
          // Thorough fallback: full seed set + full iteration budget.
          return ikClient.solveIk({ ...base, options: { ...shared } });
        };

        const controller = new RuntimeController({
          jointMeta: meta,
          profile,
          initialJoints,
          applyJoints: (values) => adapter.setJointValues(values),
          ikSolve,
          computeTcp: (joints) => computeForwardKinematics(chain, joints).tcp.position as Vec3,
          publish: (snapshot) => useRuntimeStore.getState().setSnapshot(snapshot),
          snapshotHz: 15,
          // Short min-duration keeps manual jogs responsive; successive
          // preempting steps chain into smooth continuous motion. Velocity
          // limits are still enforced post-plan by validateTrajectory.
          minDurationMs: 60,
          // A hung IK worker must never wedge the runtime in PLANNING.
          planningTimeoutMs: 2000,
        });
        runtimeRef.current = controller;
        setRuntime(controller);
        controller.bringOnline();

        const initial = adapter.getTcpWorldPosition();
        lastTcp.current = initial;
        setTcp(initial);
        setToolAxis(adapter.getTcpWorldToolAxis());
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
    const dtMs = Math.min(delta * 1000, 100);
    // Drive the runtime every frame → robot motion is rendered at full fps.
    controller.tick(dtMs);

    // Throttle the React-facing telemetry/diagnostics to keep the main thread
    // free for the render loop (no visual effect on the robot's motion).
    telemetryAccumMs.current += dtMs;
    if (telemetryAccumMs.current < TELEMETRY_INTERVAL_MS) return;
    telemetryAccumMs.current = 0;

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
      setToolAxis(adapterRef.current.getTcpWorldToolAxis());
      publishDiagnostics();
    }
  });

  if (!robot) return null;
  return <primitive object={robot} />;
}
