import type { Vec3 } from './spatial';

export type IkStatus =
  | 'converged'
  | 'max_iterations'
  | 'stagnation'
  | 'diverged'
  | 'invalid'
  | 'cancelled';

export interface IkTarget {
  /** Target TCP position in the base frame (metres). */
  readonly position: Vec3;
  /** Desired approach direction (the stylus local +Z should align to this). */
  readonly approachAxis: Vec3;
}

export interface IkOptions {
  readonly positionTolerance: number; // metres (primary hard task)
  readonly maxIterations: number;
  readonly maxStep: number; // per-joint clamp (rad) per iteration
  readonly initialLambda: number; // DLS damping
  readonly lambdaMax: number;
  readonly posture: 'midrange' | 'none';
  readonly postureGain: number;
  /** |Δq| between primary seed and solution above which a jump is flagged. */
  readonly unsafeJumpThreshold: number;
  /** Soft weight on the tool-axis (tilt-minimising) rows. Position is weight 1. */
  readonly axisWeight: number;
  /** Preferred stylus tilt from the approach direction (radians). */
  readonly preferredTiltRad: number;
  /** Hard maximum stylus tilt for a solution to be accepted (radians). */
  readonly maxTiltRad: number;
}

const DEG = Math.PI / 180;

export const DEFAULT_IK_OPTIONS: IkOptions = {
  positionTolerance: 1e-4,
  maxIterations: 300,
  maxStep: 0.35,
  initialLambda: 1e-2,
  lambdaMax: 1e6,
  posture: 'midrange',
  postureGain: 0.05,
  unsafeJumpThreshold: Math.PI,
  axisWeight: 0.01,
  preferredTiltRad: 0 * DEG,
  maxTiltRad: 20 * DEG,
};

export interface IkRequest {
  readonly target: IkTarget;
  readonly activeJoints: readonly string[];
  /** Held joints (e.g. `stylus_pitch: 0` in the competition profile). */
  readonly lockedValues: Readonly<Record<string, number>>;
  /** Optional primary seed for the active joints. */
  readonly seed?: Readonly<Record<string, number>>;
  readonly options?: Partial<IkOptions>;
}

export interface UnsafeJump {
  readonly joint: string;
  readonly delta: number;
}

export interface IkResult {
  readonly status: IkStatus;
  /** Active-joint solution. */
  readonly solution: Record<string, number>;
  /** Full movable-joint values (active + locked) used for FK verification. */
  readonly jointValues: Record<string, number>;
  readonly iterations: number;
  readonly seedIndex: number;
  readonly positionError: number;
  /** Stylus tilt from the approach direction (radians) = axis error. */
  readonly tiltRad: number;
  readonly toolAxisDot: number;
  /** Independent FK meets the position tolerance and the max-tilt bound. */
  readonly verified: boolean;
  /** Smallest distance from any active joint to its nearest limit (radians). */
  readonly jointLimitMargin: number;
  readonly unsafeJump: UnsafeJump | null;
  readonly message?: string;
}
