import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { useUiStore, type CameraPreset } from '../state/uiStore';
import { useRobotStore } from '../state/robotStore';
import type { Vec3Tuple } from './coordinates';

/** Minimal shape of the OrbitControls instance we drive (avoids a hard dep). */
interface OrbitLike {
  target: Vector3;
  update: () => void;
}

interface Pose {
  pos: Vec3Tuple;
  target: Vec3Tuple;
}

/** Static preset poses (base_link, Z-up). `tool` is derived from the live TCP. */
const PRESET_POSES: Record<Exclude<CameraPreset, 'tool'>, Pose> = {
  overview: { pos: [1.15, -1.15, 1.0], target: [0.5, 0, 0.2] },
  front: { pos: [0.5, -1.5, 0.35], target: [0.5, 0, 0.2] },
  side: { pos: [1.7, 0.02, 0.4], target: [0.4, 0, 0.2] },
  top: { pos: [0.5, 0.001, 1.7], target: [0.5, 0, 0.03] },
  pin: { pos: [0.52, -0.62, 0.5], target: [0.52, 0, 0.02] },
};

function poseFor(preset: CameraPreset, tcp: Vec3Tuple | null): Pose {
  if (preset === 'tool') {
    const t: Vec3Tuple = tcp ?? [0.5, 0, 0.2];
    return { pos: [t[0] + 0.16, t[1] - 0.26, t[2] + 0.16], target: t };
  }
  return PRESET_POSES[preset];
}

/**
 * Smoothly animates the camera to the selected preset, then yields control back
 * to OrbitControls so manual orbiting still works. Presentation only — no robot,
 * runtime, or safety state is touched.
 */
export function CameraRig() {
  const preset = useUiStore((s) => s.cameraPreset);
  const nonce = useUiStore((s) => s.cameraNonce);
  const tcp = useRobotStore((s) => s.tcp);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitLike | null;

  const animating = useRef(false);
  const goalPos = useRef(new Vector3());
  const goalTarget = useRef(new Vector3());

  // (Re)arm the transition whenever a preset is chosen.
  useEffect(() => {
    const pose = poseFor(preset, tcp);
    goalPos.current.set(...pose.pos);
    goalTarget.current.set(...pose.target);
    animating.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useFrame((_, dt) => {
    if (!animating.current || !controls) return;
    // Tool view tracks a moving target; refresh the goal each frame.
    if (preset === 'tool' && tcp) goalTarget.current.set(...tcp);

    const k = 8;
    camera.position.x = MathUtils.damp(camera.position.x, goalPos.current.x, k, dt);
    camera.position.y = MathUtils.damp(camera.position.y, goalPos.current.y, k, dt);
    camera.position.z = MathUtils.damp(camera.position.z, goalPos.current.z, k, dt);

    const tgt = controls.target;
    tgt.x = MathUtils.damp(tgt.x, goalTarget.current.x, k, dt);
    tgt.y = MathUtils.damp(tgt.y, goalTarget.current.y, k, dt);
    tgt.z = MathUtils.damp(tgt.z, goalTarget.current.z, k, dt);
    controls.update();

    if (
      preset !== 'tool' &&
      camera.position.distanceTo(goalPos.current) < 0.004 &&
      tgt.distanceTo(goalTarget.current) < 0.004
    ) {
      animating.current = false;
    }
  });

  return null;
}
