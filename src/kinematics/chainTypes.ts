import type { Vec3 } from './spatial';

/**
 * Serializable kinematic chain types.
 *
 * These contain only plain numbers/strings/arrays so a chain can be structured
 * cloned and sent to a Web Worker. No Three.js or gl-matrix objects appear here.
 */

export type JointType =
  | 'revolute'
  | 'continuous'
  | 'prismatic'
  | 'fixed'
  | 'planar'
  | 'floating';

export interface JointLimit {
  readonly lower: number;
  readonly upper: number;
  readonly effort: number;
  readonly velocity: number;
}

export interface ChainJoint {
  readonly name: string;
  readonly type: JointType;
  readonly parentLink: string;
  readonly childLink: string;
  readonly originXyz: Vec3;
  readonly originRpy: Vec3;
  /** Local rotation/translation axis (unit-ish; normalized by the FK engine). */
  readonly axis: Vec3;
  readonly limit: JointLimit | null;
}

export interface KinematicChain {
  readonly baseLink: string;
  readonly tipLink: string;
  /** Ordered base → tip. */
  readonly joints: readonly ChainJoint[];
}

/** True for joints that consume a joint value (movable). */
export function isMovable(type: JointType): boolean {
  return type === 'revolute' || type === 'continuous' || type === 'prismatic';
}
