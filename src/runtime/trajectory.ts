/**
 * Joint-space quintic minimum-jerk trajectories.
 *
 *   s(τ)  = 10τ³ − 15τ⁴ + 6τ⁵          (0 at τ=0, 1 at τ=1; zero vel/accel ends)
 *   s'(τ) = 30τ² − 60τ³ + 30τ⁴
 *
 * Peak of s'(τ) is 1.875 at τ = 0.5, so the peak joint speed for a move of
 * amplitude Δq over duration T is |Δq|·1.875 / T. The duration is chosen so no
 * active joint exceeds its configured velocity limit.
 */

export const PEAK_S_PRIME = 1.875; // max of s'(τ) at τ = 0.5

export function quinticS(tau: number): number {
  const t = clamp01(tau);
  return t * t * t * (10 + t * (-15 + 6 * t));
}

export function quinticSPrime(tau: number): number {
  const t = clamp01(tau);
  return 30 * t * t - 60 * t * t * t + 30 * t * t * t * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export interface JointLimitInfo {
  readonly name: string;
  readonly velocity: number; // rad/s (0 or non-finite → treated as unbounded)
}

export interface JointTrajectory {
  readonly names: readonly string[];
  readonly start: Readonly<Record<string, number>>;
  readonly goal: Readonly<Record<string, number>>;
  readonly durationMs: number;
  /** Time cursor in ms (advanced by the runtime tick). */
  elapsedMs: number;
}

/**
 * Choose the minimum duration (ms) that keeps every joint's peak quintic speed
 * within its velocity limit. `minDurationMs` is a floor so tiny moves still take
 * a sensible time.
 */
export function minJerkDuration(
  start: Readonly<Record<string, number>>,
  goal: Readonly<Record<string, number>>,
  limits: readonly JointLimitInfo[],
  minDurationMs = 200,
): number {
  let durationS = minDurationMs / 1000;
  for (const lim of limits) {
    const delta = Math.abs((goal[lim.name] ?? 0) - (start[lim.name] ?? 0));
    if (delta === 0) continue;
    if (Number.isFinite(lim.velocity) && lim.velocity > 0) {
      const required = (delta * PEAK_S_PRIME) / lim.velocity;
      if (required > durationS) durationS = required;
    }
  }
  return durationS * 1000;
}

export function createJointTrajectory(
  names: readonly string[],
  start: Readonly<Record<string, number>>,
  goal: Readonly<Record<string, number>>,
  durationMs: number,
): JointTrajectory {
  return { names, start: { ...start }, goal: { ...goal }, durationMs: Math.max(1, durationMs), elapsedMs: 0 };
}

/** Sample joint positions at the trajectory's current elapsed time. */
export function sampleTrajectory(traj: JointTrajectory): Record<string, number> {
  const tau = traj.durationMs <= 0 ? 1 : traj.elapsedMs / traj.durationMs;
  const s = quinticS(tau);
  const out: Record<string, number> = {};
  for (const name of traj.names) {
    const a = traj.start[name] ?? 0;
    const b = traj.goal[name] ?? 0;
    out[name] = a + (b - a) * s;
  }
  return out;
}

/** Peak absolute joint speed (rad/s) each joint reaches over the move. */
export function peakSpeeds(traj: JointTrajectory): Record<string, number> {
  const tSec = traj.durationMs / 1000;
  const out: Record<string, number> = {};
  for (const name of traj.names) {
    const delta = Math.abs((traj.goal[name] ?? 0) - (traj.start[name] ?? 0));
    out[name] = tSec > 0 ? (delta * PEAK_S_PRIME) / tSec : 0;
  }
  return out;
}

export function isComplete(traj: JointTrajectory): boolean {
  return traj.elapsedMs >= traj.durationMs;
}
