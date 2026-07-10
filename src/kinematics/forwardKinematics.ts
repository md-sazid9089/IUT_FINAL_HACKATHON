import {
  axisAngleTransform,
  cloneMat4,
  identityMat4,
  isFiniteQuat,
  isFiniteVec3,
  multiplyInto,
  originTransform,
  rotationOf,
  transformDirection,
  translationOf,
  type Mat4,
  type Quat,
  type Vec3,
} from './spatial';
import { isMovable, type KinematicChain } from './chainTypes';

export type JointValues = Readonly<Record<string, number>>;

export interface Pose {
  readonly position: Vec3;
  readonly quaternion: Quat;
}

export interface FkResult {
  /** Tip (TCP) pose in the base frame. */
  readonly tcp: Pose;
  /** World-frame origin position of each joint frame, keyed by joint name. */
  readonly jointOrigins: Record<string, Vec3>;
  /** World-frame unit axis direction of each joint, keyed by joint name. */
  readonly jointAxes: Record<string, Vec3>;
}

/**
 * Independent forward kinematics.
 *
 * For each joint (base → tip):
 *   T_frame  = T_parent · Origin(xyz, rpy)     ← joint frame (pre-rotation)
 *   T_child  = T_frame · Rot(axis, q)          ← child link frame
 *
 * Joint origins/axes are recorded from `T_frame`. Movable joints consume a value
 * from `jointValues` (missing → 0). Locked revolute joints (e.g. `stylus_pitch`
 * in the competition profile) are handled identically: the caller passes their
 * held value. Fixed joints contribute only their origin transform.
 *
 * This engine uses gl-matrix / Float64 only — no Three.js.
 */
export function computeForwardKinematics(
  chain: KinematicChain,
  jointValues: JointValues,
): FkResult {
  const world: Mat4 = identityMat4();
  const jointOrigins: Record<string, Vec3> = {};
  const jointAxes: Record<string, Vec3> = {};

  for (const joint of chain.joints) {
    // Advance to the joint frame (before applying the joint's own rotation).
    multiplyInto(world, originTransform(joint.originXyz, joint.originRpy));

    const originWorld = translationOf(world);
    const axisWorld = transformDirection(world, joint.axis);
    jointOrigins[joint.name] = originWorld;
    jointAxes[joint.name] = axisWorld;

    if (isMovable(joint.type)) {
      const value = jointValues[joint.name] ?? 0;
      // Prismatic support is not required this gate; revolute/continuous only.
      multiplyInto(world, axisAngleTransform(joint.axis, value));
    }
    // Fixed joints: origin transform already applied; no rotation.
  }

  const position = translationOf(world);
  const quaternion = rotationOf(cloneMat4(world));

  if (!isFiniteVec3(position) || !isFiniteQuat(quaternion)) {
    throw new Error('FK produced a non-finite TCP pose');
  }

  return {
    tcp: { position, quaternion },
    jointOrigins,
    jointAxes,
  };
}

/**
 * Tool approach axis in the base frame: the tip's local +Z expressed in world.
 * The stylus barrel/nib runs along the stylus local +Z.
 */
export function toolAxisFromPose(pose: Pose): Vec3 {
  return transformDirectionFromQuat(pose.quaternion, [0, 0, 1]);
}

function transformDirectionFromQuat(q: Quat, axis: Vec3): Vec3 {
  // Local import avoided; reuse spatial rotate via a tiny inline using quat math.
  const [x, y, z, w] = q;
  const [ax, ay, az] = axis;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * az - z * ay);
  const ty = 2 * (z * ax - x * az);
  const tz = 2 * (x * ay - y * ax);
  // v' = v + w * t + cross(q.xyz, t)
  const rx = ax + w * tx + (y * tz - z * ty);
  const ry = ay + w * ty + (z * tx - x * tz);
  const rz = az + w * tz + (x * ty - y * tx);
  const len = Math.hypot(rx, ry, rz) || 1;
  return [rx / len, ry / len, rz / len];
}
