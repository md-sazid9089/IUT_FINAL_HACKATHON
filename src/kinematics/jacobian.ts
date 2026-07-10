import type { FkResult } from './forwardKinematics';
import { toolAxisFromPose } from './forwardKinematics';
import type { Vec3 } from './spatial';

/**
 * World-space geometric Jacobian for a set of active revolute joints.
 *
 * For revolute joint j with world axis zⱼ and world origin pⱼ, and TCP position
 * p:
 *   linear column  = zⱼ × (p − pⱼ)
 *   angular column = zⱼ
 *
 * Rows 0..2 are linear velocity, rows 3..5 are angular velocity. Row-major
 * `Float64Array` of length 6·n.
 */
export function geometricJacobian(
  fk: FkResult,
  activeJoints: readonly string[],
  out: Float64Array,
): void {
  const p = fk.tcp.position;
  const n = activeJoints.length;
  for (let j = 0; j < n; j++) {
    const name = activeJoints[j]!;
    const z = fk.jointAxes[name]!;
    const o = fk.jointOrigins[name]!;
    const rx = p[0] - o[0];
    const ry = p[1] - o[1];
    const rz = p[2] - o[2];
    // linear = z × r
    out[0 * n + j] = z[1] * rz - z[2] * ry;
    out[1 * n + j] = z[2] * rx - z[0] * rz;
    out[2 * n + j] = z[0] * ry - z[1] * rx;
    // angular = z
    out[3 * n + j] = z[0];
    out[4 * n + j] = z[1];
    out[5 * n + j] = z[2];
  }
}

export interface ToolAxisBasis {
  /** Desired approach direction (unit). */
  readonly d: Vec3;
  /** Two orthonormal vectors spanning the plane ⊥ d. */
  readonly t1: Vec3;
  readonly t2: Vec3;
}

/** Build an orthonormal basis {t1, t2} for the plane perpendicular to `d`. */
export function toolAxisBasis(d: Vec3): ToolAxisBasis {
  const dn = normalize(d);
  // Pick a helper axis least aligned with d.
  const helper: Vec3 =
    Math.abs(dn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t1 = normalize(cross(dn, helper));
  const t2 = normalize(cross(dn, t1));
  return { d: dn, t1, t2 };
}

export interface TaskEvaluation {
  /** 5×n task Jacobian (rows: 3 position, 2 tool-axis), row-major. */
  readonly J: Float64Array;
  /** 5-vector task error (desired − current). */
  readonly e: Float64Array;
  readonly positionError: number;
  readonly axisError: number;
  readonly toolAxisDot: number;
  readonly toolAxis: Vec3;
}

/**
 * Build the five-constraint key-press task at the current FK pose:
 *   - 3 position constraints: p → p_target
 *   - 2 tool-axis alignment constraints derived from the angular Jacobian
 * The stylus local +Z axis `a` aligns to the approach direction `d`; rotation
 * about the stylus axis is left free (only two alignment rows, projected onto
 * the plane ⊥ d). The orientation error is the rotation vector that carries `a`
 * onto `d` (a log-map), which stays well-defined even when the tool initially
 * points away from `d` (the antipodal case), unlike a raw cross-product error.
 */
export function evaluateKeyPressTask(
  fk: FkResult,
  activeJoints: readonly string[],
  targetPosition: Vec3,
  basis: ToolAxisBasis,
  jacobianScratch: Float64Array, // length ≥ 6·n
  J: Float64Array, // length ≥ 5·n
  e: Float64Array, // length ≥ 5
): TaskEvaluation {
  const n = activeJoints.length;
  geometricJacobian(fk, activeJoints, jacobianScratch);

  const p = fk.tcp.position;
  const a = toolAxisFromPose(fk.tcp);
  const { d, t1, t2 } = basis;

  // Position rows (linear part of geometric Jacobian).
  for (let row = 0; row < 3; row++) {
    for (let j = 0; j < n; j++) {
      J[row * n + j] = jacobianScratch[row * n + j]!;
    }
  }
  e[0] = targetPosition[0] - p[0];
  e[1] = targetPosition[1] - p[1];
  e[2] = targetPosition[2] - p[2];

  // Tool-axis rows: project the angular Jacobian column zⱼ onto {t1, t2}.
  for (let j = 0; j < n; j++) {
    const zx = jacobianScratch[3 * n + j]!;
    const zy = jacobianScratch[4 * n + j]!;
    const zz = jacobianScratch[5 * n + j]!;
    J[3 * n + j] = t1[0] * zx + t1[1] * zy + t1[2] * zz;
    J[4 * n + j] = t2[0] * zx + t2[1] * zy + t2[2] * zz;
  }

  // Orientation error = rotation vector that aligns a → d, projected onto ⊥ d.
  const rot = alignRotationVector(a, d);
  e[3] = t1[0] * rot[0] + t1[1] * rot[1] + t1[2] * rot[2];
  e[4] = t2[0] * rot[0] + t2[1] * rot[1] + t2[2] * rot[2];

  const positionError = Math.hypot(e[0], e[1], e[2]);
  const dot = clamp(a[0] * d[0] + a[1] * d[1] + a[2] * d[2], -1, 1);
  const axisError = Math.acos(dot);

  return { J, e, positionError, axisError, toolAxisDot: dot, toolAxis: a };
}

/**
 * Rotation vector (axis·angle) that rotates unit vector `a` onto unit vector
 * `d`. Robust at the antipode: returns a π rotation about an axis ⊥ a.
 */
export function alignRotationVector(a: Vec3, d: Vec3): Vec3 {
  const c = cross(a, d);
  const s = Math.hypot(c[0], c[1], c[2]);
  const dp = a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  const angle = Math.atan2(s, dp);
  if (s < 1e-9) {
    if (dp >= 0) return [0, 0, 0];
    // Antipodal: rotate by π about any axis perpendicular to a.
    const helper: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const perp = normalize(cross(a, helper));
    return [perp[0] * Math.PI, perp[1] * Math.PI, perp[2] * Math.PI];
  }
  const k = angle / s;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
