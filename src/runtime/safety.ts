import type { JointMeta } from '../robot/RobotModelAdapter';
import type { RobotProfile } from '../config/robotProfiles';
import type { RuntimeState } from './runtimeState';
import { MOVEMENT_READY_STATES } from './runtimeState';
import type { MoveJointsCommand } from './commands';
import { peakSpeeds, type JointTrajectory } from './trajectory';

/**
 * Deterministic safety supervisor. Both the pre-check (before planning/IK) and
 * the post-plan validation (after a trajectory/IK solution) live here. Every
 * rejection carries a clear, human-readable reason. Any failure means the robot
 * does not move.
 */

export interface SafetyContext {
  readonly jointMeta: readonly JointMeta[];
  readonly profile: RobotProfile;
  readonly state: RuntimeState;
  readonly eStopped: boolean;
  /** Current commanded joint values. */
  readonly current: Readonly<Record<string, number>>;
  /** Max allowed |Δq| for any single joint in one commanded move (rad). */
  readonly maxJointJump: number;
  /** Velocity tolerance factor (e.g. 1.001) to absorb float noise. */
  readonly velocityTolerance: number;
}

export interface SafetyResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly code?: SafetyCode;
}

export type SafetyCode =
  | 'estopped'
  | 'state_forbids_motion'
  | 'non_finite'
  | 'unknown_joint'
  | 'locked_joint'
  | 'inactive_joint'
  | 'joint_limit'
  | 'velocity_limit'
  | 'joint_jump';

const ok: SafetyResult = { ok: true };
function fail(code: SafetyCode, reason: string): SafetyResult {
  return { ok: false, code, reason };
}

function metaByName(ctx: SafetyContext): Map<string, JointMeta> {
  const m = new Map<string, JointMeta>();
  for (const j of ctx.jointMeta) m.set(j.name, j);
  return m;
}

/**
 * Pre-check for a joint-move command, before any planning:
 * E-stop, runtime state, finite values, known joints, active/locked rules,
 * joint limits, and maximum single-move joint jump.
 */
export function precheckMoveJoints(cmd: MoveJointsCommand, ctx: SafetyContext): SafetyResult {
  if (ctx.eStopped) return fail('estopped', 'Rejected: robot is E-stopped; explicit reset required');
  if (!MOVEMENT_READY_STATES.has(ctx.state)) {
    return fail('state_forbids_motion', `Rejected: cannot move while runtime is ${ctx.state}`);
  }

  const meta = metaByName(ctx);
  for (const [name, value] of Object.entries(cmd.joints)) {
    if (!Number.isFinite(value)) {
      return fail('non_finite', `Rejected: joint "${name}" target is not finite`);
    }
    const jm = meta.get(name);
    if (!jm) return fail('unknown_joint', `Rejected: unknown joint "${name}"`);

    const isLocked = name in ctx.profile.lockedJoints;
    if (isLocked) {
      const lockValue = ctx.profile.lockedJoints[name]!;
      if (Math.abs(value - lockValue) > 1e-9) {
        return fail('locked_joint', `Rejected: joint "${name}" is locked at ${lockValue} rad`);
      }
      continue; // locked joint commanded to its lock value is allowed (no-op)
    }
    if (!ctx.profile.activeJoints.includes(name)) {
      return fail('inactive_joint', `Rejected: joint "${name}" is not an active control joint`);
    }
    if (value < jm.lower - 1e-9 || value > jm.upper + 1e-9) {
      return fail(
        'joint_limit',
        `Rejected: joint "${name}" target ${value.toFixed(4)} outside limits [${jm.lower.toFixed(4)}, ${jm.upper.toFixed(4)}]`,
      );
    }
    const jump = Math.abs(value - (ctx.current[name] ?? 0));
    if (jump > ctx.maxJointJump) {
      return fail(
        'joint_jump',
        `Rejected: joint "${name}" jump ${jump.toFixed(3)} rad exceeds max ${ctx.maxJointJump} rad`,
      );
    }
  }
  return ok;
}

/**
 * Post-plan validation of a generated trajectory: finite samples, limits, and
 * per-joint peak velocity within the configured velocity limits.
 */
export function validateTrajectory(traj: JointTrajectory, ctx: SafetyContext): SafetyResult {
  const meta = metaByName(ctx);
  const speeds = peakSpeeds(traj);
  for (const name of traj.names) {
    const jm = meta.get(name);
    if (!jm) return fail('unknown_joint', `Rejected trajectory: unknown joint "${name}"`);
    const goal = traj.goal[name] ?? 0;
    if (!Number.isFinite(goal)) return fail('non_finite', `Rejected trajectory: "${name}" goal not finite`);
    const isLocked = name in ctx.profile.lockedJoints;
    if (!isLocked && (goal < jm.lower - 1e-9 || goal > jm.upper + 1e-9)) {
      return fail('joint_limit', `Rejected trajectory: "${name}" goal outside limits`);
    }
    if (Number.isFinite(jm.velocity) && jm.velocity > 0) {
      if (speeds[name]! > jm.velocity * ctx.velocityTolerance) {
        return fail(
          'velocity_limit',
          `Rejected trajectory: "${name}" peak speed ${speeds[name]!.toFixed(3)} exceeds limit ${jm.velocity} rad/s`,
        );
      }
    }
  }
  return ok;
}
