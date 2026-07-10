import type { JointMeta } from '../robot/RobotModelAdapter';
import type { RobotProfile } from '../config/robotProfiles';
import type { IkResult } from '../kinematics/ikTypes';
import {
  isMovementCommand,
  parseCommand,
  priorityOf,
  type CommandSource,
  type MoveJointsCommand,
  type NormalizedCommand,
} from './commands';
import { canTransition, type RuntimeState } from './runtimeState';
import {
  createJointTrajectory,
  isComplete,
  minJerkDuration,
  sampleTrajectory,
  type JointLimitInfo,
  type JointTrajectory,
} from './trajectory';
import {
  precheckMoveJoints,
  validateTrajectory,
  type SafetyContext,
  type SafetyResult,
} from './safety';
import { EventLog, type RuntimeEvent } from './events';

export type Vec3 = [number, number, number];

export interface IkSolveFn {
  (position: Vec3, approachAxis: Vec3): Promise<IkResult>;
}

export interface RuntimeSnapshot {
  readonly state: RuntimeState;
  readonly eStopped: boolean;
  readonly jointValues: Record<string, number>;
  readonly activeCommand: { id: string; type: string; source: CommandSource } | null;
  readonly queueLength: number;
  readonly progress: number;
  readonly lastRejection: string | null;
  readonly events: RuntimeEvent[];
}

export interface RuntimeOptions {
  readonly jointMeta: readonly JointMeta[];
  readonly profile: RobotProfile;
  readonly initialJoints: Readonly<Record<string, number>>;
  /** The ONLY production sink that reaches RobotModelAdapter.setJointValues. */
  readonly applyJoints: (values: Record<string, number>) => void;
  readonly ikSolve?: IkSolveFn;
  readonly publish?: (snapshot: RuntimeSnapshot) => void;
  readonly now?: () => number;
  readonly maxJointJump?: number;
  readonly velocityTolerance?: number;
  readonly snapshotHz?: number;
  readonly minDurationMs?: number;
}

export interface SubmitResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly commandId?: string;
}

/**
 * Unified runtime controller. All robot motion flows through here:
 *   submit → schema parse → normalize → arbitration → safety pre-check →
 *   (plan / IK) → post-plan validation → trajectory → applyJoints → adapter.
 *
 * High-frequency state lives on this plain object (outside React); UI receives
 * throttled snapshots. E-stop is handled entirely out of band from the queue.
 */
export class RuntimeController {
  private state: RuntimeState = 'BOOTING';
  private eStopRequested = false;
  private resetRequested = false;
  private eStopped = false;

  private readonly current: Record<string, number>;
  private readonly queue: NormalizedCommand[] = [];
  private activeCommand: NormalizedCommand | null = null;
  private activeTrajectory: JointTrajectory | null = null;
  private pausedTrajectory: JointTrajectory | null = null;

  private planningToken = 0;
  private lastRejection: string | null = null;
  private lastPublish = -Infinity;
  private readonly log = new EventLog();

  private readonly meta: readonly JointMeta[];
  private readonly profile: RobotProfile;
  private readonly limits: JointLimitInfo[];
  private readonly maxJointJump: number;
  private readonly velocityTolerance: number;
  private readonly snapshotIntervalMs: number;
  private readonly minDurationMs: number;
  private readonly now: () => number;
  private readonly applyJoints: (values: Record<string, number>) => void;
  private readonly ikSolve?: IkSolveFn;
  private readonly publishFn?: (snapshot: RuntimeSnapshot) => void;

  constructor(opts: RuntimeOptions) {
    this.meta = opts.jointMeta;
    this.profile = opts.profile;
    this.current = { ...opts.initialJoints };
    this.applyJoints = opts.applyJoints;
    this.ikSolve = opts.ikSolve;
    this.publishFn = opts.publish;
    this.now = opts.now ?? (() => performance.now());
    this.maxJointJump = opts.maxJointJump ?? Math.PI;
    this.velocityTolerance = opts.velocityTolerance ?? 1.001;
    this.snapshotIntervalMs = 1000 / (opts.snapshotHz ?? 15);
    this.minDurationMs = opts.minDurationMs ?? 200;
    this.limits = opts.profile.activeJoints.map((name) => ({
      name,
      velocity: this.meta.find((m) => m.name === name)?.velocity ?? 0,
    }));
  }

  // ---- lifecycle ----------------------------------------------------------

  /** Step BOOTING → MODEL_LOADING → SELF_TEST → READY (self-test validates meta). */
  bringOnline(): void {
    this.transition('MODEL_LOADING', 'info', 'state_changed', 'Model loading');
    this.transition('SELF_TEST', 'info', 'state_changed', 'Self test');
    if (this.meta.length === 0) {
      this.transition('FAULT', 'error', 'fault', 'Self test failed: no joint metadata');
      return;
    }
    this.transition('READY', 'info', 'state_changed', 'Ready');
    this.applyJoints({ ...this.current });
    this.publishNow();
  }

  getState(): RuntimeState {
    return this.state;
  }
  isEStopped(): boolean {
    return this.eStopped;
  }
  getJointValues(): Record<string, number> {
    return { ...this.current };
  }
  recentEvents(n?: number): RuntimeEvent[] {
    return this.log.recent(n);
  }

  // ---- command intake -----------------------------------------------------

  /** Validate, normalize, arbitrate and route a command. Never throws. */
  submit(input: unknown): SubmitResult {
    const parsed = parseCommand(input, this.now());
    if (!parsed.ok || !parsed.command) {
      this.reject(parsed.error ?? 'Invalid command', undefined);
      return { accepted: false, reason: parsed.error };
    }
    const cmd = parsed.command;

    switch (cmd.type) {
      case 'estop':
        this.emergencyStop();
        return { accepted: true, commandId: cmd.id };
      case 'reset':
        return this.handleReset(cmd);
      case 'stop':
        return this.handleStop(cmd);
      case 'pause':
        return this.handlePause(cmd);
      case 'resume':
        return this.handleResume(cmd);
      case 'move_joints':
      case 'cartesian_move':
        return this.handleMovement(cmd);
    }
  }

  /** Out-of-band emergency stop: blocks new motion immediately; the next tick
   * cancels the active trajectory and clears the queue. */
  emergencyStop(): void {
    this.eStopRequested = true;
    this.eStopped = true; // block new movement at once
    this.planningToken += 1; // invalidate any pending planning
    this.log.add('error', 'estop', 'E-STOP requested (out of band)', { t: this.now() });
    this.publishNow();
  }

  resetEStop(): SubmitResult {
    return this.submit({ type: 'reset', source: 'system' });
  }

  // ---- control verbs ------------------------------------------------------

  private handleReset(cmd: NormalizedCommand): SubmitResult {
    if (!this.eStopped) {
      const reason = 'Reset ignored: not E-stopped';
      this.reject(reason, cmd.source);
      return { accepted: false, reason };
    }
    this.resetRequested = true;
    this.log.add('info', 'estop_reset', 'Safe reset requested', { source: cmd.source, t: this.now() });
    return { accepted: true, commandId: cmd.id };
  }

  private handleStop(cmd: NormalizedCommand): SubmitResult {
    if (this.eStopped) return { accepted: false, reason: 'E-stopped' };
    this.activeTrajectory = null;
    this.pausedTrajectory = null;
    this.activeCommand = null;
    this.queue.length = 0;
    this.forceState('STOPPING', 'stopped', 'Stop: motion cancelled, queue cleared', cmd.source);
    this.forceState('READY', 'state_changed', 'Ready', cmd.source);
    this.publishNow();
    return { accepted: true, commandId: cmd.id };
  }

  private handlePause(cmd: NormalizedCommand): SubmitResult {
    if (this.state !== 'EXECUTING' || !this.activeTrajectory) {
      const reason = 'Pause ignored: nothing executing';
      this.reject(reason, cmd.source);
      return { accepted: false, reason };
    }
    this.pausedTrajectory = this.activeTrajectory;
    this.activeTrajectory = null;
    this.forceState('PAUSED', 'paused', 'Paused', cmd.source);
    this.publishNow();
    return { accepted: true, commandId: cmd.id };
  }

  private handleResume(cmd: NormalizedCommand): SubmitResult {
    if (this.state !== 'PAUSED' || !this.pausedTrajectory) {
      const reason = 'Resume ignored: not paused';
      this.reject(reason, cmd.source);
      return { accepted: false, reason };
    }
    this.activeTrajectory = this.pausedTrajectory;
    this.pausedTrajectory = null;
    this.forceState('EXECUTING', 'resumed', 'Resumed', cmd.source);
    this.publishNow();
    return { accepted: true, commandId: cmd.id };
  }

  // ---- movement -----------------------------------------------------------

  private handleMovement(cmd: NormalizedCommand): SubmitResult {
    if (this.eStopped) {
      const reason = 'Rejected: robot is E-stopped; explicit reset required';
      this.reject(reason, cmd.source);
      return { accepted: false, reason };
    }

    // Pre-check for move_joints happens here (before planning). Cartesian
    // targets are finite-checked by schema; joint pre-check runs post-IK.
    if (cmd.type === 'move_joints') {
      const pre = this.precheck(cmd);
      if (!pre.ok) {
        this.reject(pre.reason!, cmd.source);
        return { accepted: false, reason: pre.reason };
      }
    }

    // Arbitration: a strictly higher-priority command preempts the active one.
    if (this.activeCommand && isMovementCommand(this.activeCommand)) {
      if (priorityOf(cmd.source) > priorityOf(this.activeCommand.source)) {
        this.log.add('warn', 'command_preempted', `Preempted ${this.activeCommand.source} command`, {
          source: cmd.source,
          t: this.now(),
        });
        this.activeTrajectory = null;
        this.activeCommand = null;
        this.planningToken += 1; // invalidate any in-flight planning
        this.forceState('READY', 'state_changed', 'Preempted; ready for higher-priority command', cmd.source);
      } else {
        // Queue lower/equal priority; the tick starts the highest priority next.
        this.enqueue(cmd);
        return { accepted: true, commandId: cmd.id };
      }
    }

    this.enqueue(cmd);
    this.log.add('info', 'command_accepted', `Accepted ${cmd.type} from ${cmd.source}`, {
      source: cmd.source,
      t: this.now(),
    });
    return { accepted: true, commandId: cmd.id };
  }

  private enqueue(cmd: NormalizedCommand): void {
    this.queue.push(cmd);
    // Highest priority first; stable by issue time.
    this.queue.sort((a, b) => priorityOf(b.source) - priorityOf(a.source) || a.issuedAt - b.issuedAt);
  }

  // ---- tick ---------------------------------------------------------------

  /** Advance the runtime by `dtMs`. Safe to call at any frequency. */
  tick(dtMs: number): void {
    // 1) E-stop is observed first, before anything else.
    if (this.eStopRequested) {
      this.eStopRequested = false;
      this.activeTrajectory = null;
      this.pausedTrajectory = null;
      this.activeCommand = null;
      this.queue.length = 0;
      this.forceState('E_STOPPED', 'estop', 'E-STOPPED: motion cancelled, queue cleared', 'system');
      this.publishNow();
      return;
    }

    // 2) Explicit safe reset out of E-stop.
    if (this.resetRequested && this.eStopped) {
      this.resetRequested = false;
      this.eStopped = false;
      this.forceState('SELF_TEST', 'estop_reset', 'Safe reset: self test', 'system');
      this.forceState('READY', 'state_changed', 'Ready', 'system');
      this.publishNow();
      return;
    }

    // 3) Advance an executing trajectory.
    if (this.state === 'EXECUTING' && this.activeTrajectory) {
      this.activeTrajectory.elapsedMs += dtMs;
      const sample = sampleTrajectory(this.activeTrajectory);
      this.writeActive(sample);
      if (isComplete(this.activeTrajectory)) {
        this.writeActive(this.activeTrajectory.goal);
        this.activeTrajectory = null;
        const done = this.activeCommand;
        this.activeCommand = null;
        this.forceState('READY', 'trajectory_completed', `Completed ${done?.type ?? 'move'}`, done?.source);
      }
    }

    // 4) If idle, start the next queued movement.
    if (this.state === 'READY' && !this.activeCommand && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.startMovement(next);
    }

    // 5) Keep the rendered robot in sync with the commanded state.
    this.applyJoints({ ...this.current });

    // 6) Throttled UI snapshot.
    const t = this.now();
    if (t - this.lastPublish >= this.snapshotIntervalMs) {
      this.publish(t);
    }
  }

  private startMovement(cmd: NormalizedCommand): void {
    if (cmd.type === 'move_joints') {
      this.startJointMove(cmd);
    } else if (cmd.type === 'cartesian_move') {
      this.startCartesianMove(cmd);
    }
  }

  private startJointMove(cmd: MoveJointsCommand): void {
    const goal = this.buildGoal(cmd.joints);
    const durationMs = minJerkDuration(this.current, goal, this.limits, this.minDurationMs);
    const traj = createJointTrajectory(this.profile.activeJoints, this.current, goal, durationMs);

    const post = this.validate(traj);
    if (!post.ok) {
      this.reject(post.reason!, cmd.source);
      this.forceState('READY', 'planning_failed', 'Trajectory rejected by safety', cmd.source);
      return;
    }
    this.activeCommand = cmd as NormalizedCommand;
    this.activeTrajectory = traj;
    this.forceState('EXECUTING', 'trajectory_started', `Executing ${cmd.type} from ${cmd.source}`, cmd.source);
  }

  private startCartesianMove(cmd: NormalizedCommand): void {
    if (cmd.type !== 'cartesian_move') return;
    if (!this.ikSolve) {
      this.reject('Cartesian planning unavailable (no IK solver)', cmd.source);
      this.forceState('READY', 'planning_failed', 'No IK solver', cmd.source);
      return;
    }
    this.activeCommand = cmd;
    this.planningToken += 1;
    const token = this.planningToken;
    this.forceState('PLANNING', 'planning_started', `Planning cartesian move from ${cmd.source}`, cmd.source);

    this.ikSolve(cmd.position, cmd.approachAxis)
      .then((result) => {
        // Discard if E-stopped, preempted, or superseded while planning.
        if (this.eStopped || token !== this.planningToken) return;
        if (!result.verified) {
          this.reject(`IK failed: ${result.message ?? result.status}`, cmd.source);
          this.activeCommand = null;
          this.forceState('READY', 'planning_failed', 'IK did not verify', cmd.source);
          return;
        }
        const goal = this.buildGoal(result.solution);
        const durationMs = minJerkDuration(this.current, goal, this.limits, this.minDurationMs);
        const traj = createJointTrajectory(this.profile.activeJoints, this.current, goal, durationMs);
        const post = this.validate(traj);
        if (!post.ok) {
          this.reject(post.reason!, cmd.source);
          this.activeCommand = null;
          this.forceState('READY', 'planning_failed', 'Planned trajectory rejected', cmd.source);
          return;
        }
        this.activeTrajectory = traj;
        this.forceState('EXECUTING', 'trajectory_started', 'Executing planned cartesian move', cmd.source);
      })
      .catch((err: unknown) => {
        if (this.eStopped || token !== this.planningToken) return;
        this.reject(`Planning error: ${err instanceof Error ? err.message : String(err)}`, cmd.source);
        this.activeCommand = null;
        this.forceState('READY', 'planning_failed', 'Planning error', cmd.source);
      });
  }

  /** Merge requested joint targets over the current state; locked joints held. */
  private buildGoal(requested: Readonly<Record<string, number>>): Record<string, number> {
    const goal: Record<string, number> = { ...this.current };
    for (const name of this.profile.activeJoints) {
      if (name in requested) goal[name] = requested[name]!;
    }
    for (const [name, value] of Object.entries(this.profile.lockedJoints)) {
      goal[name] = value;
    }
    return goal;
  }

  private writeActive(values: Record<string, number>): void {
    for (const name of this.profile.activeJoints) {
      if (name in values) this.current[name] = values[name]!;
    }
    for (const [name, value] of Object.entries(this.profile.lockedJoints)) {
      this.current[name] = value;
    }
  }

  // ---- safety context -----------------------------------------------------

  private ctx(): SafetyContext {
    return {
      jointMeta: this.meta,
      profile: this.profile,
      state: this.state,
      eStopped: this.eStopped,
      current: this.current,
      maxJointJump: this.maxJointJump,
      velocityTolerance: this.velocityTolerance,
    };
  }

  private precheck(cmd: MoveJointsCommand): SafetyResult {
    return precheckMoveJoints(cmd, this.ctx());
  }

  private validate(traj: JointTrajectory): SafetyResult {
    return validateTrajectory(traj, this.ctx());
  }

  // ---- state / snapshots --------------------------------------------------

  private transition(
    to: RuntimeState,
    level: 'info' | 'warn' | 'error',
    kind: Parameters<EventLog['add']>[1],
    message: string,
  ): void {
    if (!canTransition(this.state, to)) {
      this.log.add('warn', 'fault', `Illegal transition ${this.state} → ${to}`, { t: this.now() });
      return;
    }
    this.state = to;
    this.log.add(level, kind, message, { state: to, t: this.now() });
  }

  private forceState(
    to: RuntimeState,
    kind: Parameters<EventLog['add']>[1],
    message: string,
    source?: CommandSource,
  ): void {
    // Control paths (stop/estop/reset) may need to move between states the
    // normal table also permits; guard illegal ones but never throw.
    if (this.state !== to && !canTransition(this.state, to)) {
      this.log.add('warn', 'fault', `Illegal transition ${this.state} → ${to}`, { t: this.now() });
    }
    this.state = to;
    this.log.add(kind === 'estop' || kind === 'fault' ? 'error' : 'info', kind, message, {
      state: to,
      source,
      t: this.now(),
    });
  }

  private reject(reason: string, source?: CommandSource): void {
    this.lastRejection = reason;
    this.log.add('warn', 'command_rejected', reason, { source, t: this.now() });
    this.publishNow();
  }

  private snapshot(): RuntimeSnapshot {
    const progress =
      this.activeTrajectory && this.activeTrajectory.durationMs > 0
        ? Math.min(1, this.activeTrajectory.elapsedMs / this.activeTrajectory.durationMs)
        : this.state === 'READY'
          ? 1
          : 0;
    return {
      state: this.state,
      eStopped: this.eStopped,
      jointValues: { ...this.current },
      activeCommand: this.activeCommand
        ? { id: this.activeCommand.id, type: this.activeCommand.type, source: this.activeCommand.source }
        : null,
      queueLength: this.queue.length,
      progress,
      lastRejection: this.lastRejection,
      events: this.log.recent(20),
    };
  }

  private publish(t: number): void {
    this.lastPublish = t;
    this.publishFn?.(this.snapshot());
  }

  private publishNow(): void {
    this.publish(this.now());
  }
}
