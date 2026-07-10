import { glMatrix, mat4, quat, vec3 } from 'gl-matrix';

/**
 * Spatial math wrapper for the independent FK engine.
 *
 * gl-matrix is configured to allocate `Float64Array` for all created matrices,
 * vectors, and quaternions (double precision is required to hit the
 * 1e-4 tolerance budget). This module owns every allocation so the array type
 * is guaranteed to be set before anything is created.
 *
 * NOTE: This engine is intentionally independent of Three.js. It must not import
 * or reuse any Three.js math — Three.js provides only the *reference* pose that
 * this engine is validated against.
 */
glMatrix.setMatrixArrayType(Float64Array as unknown as Float32ArrayConstructor);

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Mat4 = Float64Array;

export function createMat4(): Mat4 {
  return mat4.create() as Mat4;
}

export function identityMat4(): Mat4 {
  const m = mat4.create();
  return m as Mat4;
}

/**
 * URDF fixed-axis roll-pitch-yaw → quaternion.
 * URDF applies extrinsic rotations X (roll) then Y (pitch) then Z (yaw):
 * R = Rz(yaw) · Ry(pitch) · Rx(roll). This is the standard tf/URDF formula.
 */
export function rpyToQuat(roll: number, pitch: number, yaw: number): Quat {
  const cr = Math.cos(roll / 2);
  const sr = Math.sin(roll / 2);
  const cp = Math.cos(pitch / 2);
  const sp = Math.sin(pitch / 2);
  const cy = Math.cos(yaw / 2);
  const sy = Math.sin(yaw / 2);

  const x = sr * cp * cy - cr * sp * sy;
  const y = cr * sp * cy + sr * cp * sy;
  const z = cr * cp * sy - sr * sp * cy;
  const w = cr * cp * cy + sr * sp * sy;
  return [x, y, z, w];
}

/** Homogeneous transform from an origin translation and RPY rotation. */
export function originTransform(xyz: Vec3, rpy: Vec3): Mat4 {
  const q = rpyToQuat(rpy[0], rpy[1], rpy[2]);
  const out = mat4.create();
  mat4.fromRotationTranslation(out, q as unknown as quat, xyz as unknown as vec3);
  return out as Mat4;
}

/** Homogeneous transform for a rotation of `angle` rad about a local `axis`. */
export function axisAngleTransform(axis: Vec3, angle: number): Mat4 {
  const n = vec3.fromValues(axis[0], axis[1], axis[2]);
  vec3.normalize(n, n);
  const q = quat.create();
  quat.setAxisAngle(q, n, angle);
  const out = mat4.create();
  mat4.fromQuat(out, q);
  return out as Mat4;
}

/** In-place `a = a · b`. */
export function multiplyInto(a: Mat4, b: Mat4): void {
  mat4.multiply(a, a, b);
}

export function cloneMat4(m: Mat4): Mat4 {
  return mat4.clone(m) as Mat4;
}

export function translationOf(m: Mat4): Vec3 {
  const out = vec3.create();
  mat4.getTranslation(out, m);
  return [out[0], out[1], out[2]];
}

export function rotationOf(m: Mat4): Quat {
  const out = quat.create();
  mat4.getRotation(out, m);
  quat.normalize(out, out);
  return [out[0], out[1], out[2], out[3]];
}

/** Rotate a direction vector by a quaternion (no translation). */
export function rotateVectorByQuat(q: Quat, v: Vec3): Vec3 {
  const out = vec3.create();
  vec3.transformQuat(out, vec3.fromValues(v[0], v[1], v[2]), q as unknown as quat);
  return [out[0], out[1], out[2]];
}

/** Direction of a local axis expressed in the frame described by transform `m`. */
export function transformDirection(m: Mat4, axis: Vec3): Vec3 {
  const q = rotationOf(m);
  const d = rotateVectorByQuat(q, axis);
  const n = vec3.fromValues(d[0], d[1], d[2]);
  vec3.normalize(n, n);
  return [n[0], n[1], n[2]];
}

export function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

export function isFiniteQuat(q: Quat): boolean {
  return q.every((c) => Number.isFinite(c));
}
