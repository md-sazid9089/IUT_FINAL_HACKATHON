import type { Quat, Vec3 } from './spatial';

/** Euclidean distance between two positions (metres). */
export function positionError(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Geodesic angle between two orientations (radians), sign-agnostic (q and −q are
 * the same rotation).
 */
export function orientationErrorRad(a: Quat, b: Quat): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const clamped = Math.min(1, Math.max(-1, Math.abs(dot)));
  return 2 * Math.acos(clamped);
}

/** Dot product of two (already unit) tool-axis directions. */
export function toolAxisDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export interface PoseComparison {
  readonly positionError: number;
  readonly orientationError: number;
  readonly toolAxisDot: number;
}

export function comparePoses(
  fkPos: Vec3,
  refPos: Vec3,
  fkQuat: Quat,
  refQuat: Quat,
  fkToolAxis: Vec3,
  refToolAxis: Vec3,
): PoseComparison {
  return {
    positionError: positionError(fkPos, refPos),
    orientationError: orientationErrorRad(fkQuat, refQuat),
    toolAxisDot: toolAxisDot(fkToolAxis, refToolAxis),
  };
}
