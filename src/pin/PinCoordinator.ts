import type { KeyConfig } from '../config/keyConfig';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import type { KinematicChain } from '../kinematics/chainTypes';
import type { Vec3 } from '../kinematics/spatial';
import type { RuntimeController } from '../runtime/RuntimeController';
import { useRobotStore } from '../state/robotStore';
import { useRuntimeStore } from '../state/runtimeStore';
import { PIN_MOTION_CONFIG } from './pinConfig';
import { planPinSequence, type PinPlan, type PinWaypoint } from './pinPlanner';
import { cacheKeyForRuntimeAssets, getCachedPlan, setCachedPlan } from './poseCache';
import { distanceM, type PinPressEvidence, type PinRunReport } from './pinReports';
import { validatePin } from './pinValidation';
import { usePinStore } from './pinStore';

interface CoordinatorOptions {
  readonly keyConfig: KeyConfig;
  readonly chain: KinematicChain;
  readonly runtime: RuntimeController;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowId(): string {
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function tcpSnapshot(): Vec3 | null {
  const tcp = useRobotStore.getState().tcp;
  return tcp ? [tcp[0], tcp[1], tcp[2]] : null;
}

function runtimeState() {
  return useRuntimeStore.getState().snapshot;
}

export class PinCoordinator {
  private cancelled = false;
  private paused = false;

  constructor(private readonly opts: CoordinatorOptions) {}

  cancel(): void {
    this.cancelled = true;
    this.opts.runtime.submit({ type: 'stop', source: 'autonomous' });
    usePinStore.getState().setStatus({ state: 'CANCELLING', stage: 'cancel requested' });
  }

  pause(): void {
    this.paused = true;
    this.opts.runtime.submit({ type: 'pause', source: 'autonomous' });
  }

  resume(): void {
    this.paused = false;
    this.opts.runtime.submit({ type: 'resume', source: 'autonomous' });
  }

  emergencyStop(): void {
    this.cancelled = true;
    this.opts.runtime.emergencyStop();
    usePinStore.getState().setStatus({ state: 'E_STOPPED', stage: 'E-stop' });
  }

  async preflight(pin: string): Promise<PinPlan> {
    const validation = validatePin(pin, this.opts.keyConfig);
    if (!validation.ok) {
      usePinStore.getState().setStatus({
        state: 'FAILED',
        validationMessage: validation.reason,
        error: validation.reason,
      });
      throw new Error(validation.reason ?? 'Invalid PIN');
    }

    usePinStore.getState().setStatus({
      state: 'PREFLIGHTING',
      validationMessage: 'Preflighting full sequence with competition_6dof',
      error: null,
      activeDigitIndex: null,
      activeKey: null,
      stage: 'preflight',
    });

    const key = await cacheKeyForRuntimeAssets(this.opts.keyConfig, COMPETITION_6DOF);
    const cached = getCachedPlan(key, pin);
    const plan = cached ?? planPinSequence(this.opts.chain, this.opts.keyConfig, pin);
    if (plan.allVerified) {
      setCachedPlan(key, plan);
      usePinStore.getState().setStatus({
        state: 'PREFLIGHT_READY',
        validationMessage: 'Preflight ready',
        plan,
        error: null,
      });
      return plan;
    }

    usePinStore.getState().setStatus({
      state: 'FAILED',
      validationMessage: plan.failureReason,
      plan,
      error: plan.failureReason,
    });
    throw new Error(plan.failureReason ?? 'Preflight failed');
  }

  async execute(plan: PinPlan): Promise<PinRunReport> {
    this.cancelled = false;
    const started = Date.now();
    const runId = nowId();
    const report: PinRunReport = {
      runId,
      pin: plan.pin,
      startedAtIso: new Date(started).toISOString(),
      completedAtIso: null,
      outcome: 'failed',
      presses: [],
      events: [],
    };

    usePinStore.getState().setStatus({ state: 'STARTING', error: null, stage: 'starting', report });

    try {
      for (const digit of plan.digits) {
        if (this.cancelled) throw new Error('PIN cancelled');
        useRobotStore.getState().setTargetKey(digit.key);
        usePinStore.getState().setStatus({
          activeDigitIndex: digit.digitIndex,
          activeKey: digit.key,
          state: 'TRAVELLING',
          stage: 'travel',
        });

        let hoverSuccess = true;
        let descentSuccess = true;
        let contactSuccess = true;
        let retractSuccess = true;
        let contactActual: Vec3 | null = null;
        let contactWaypoint: PinWaypoint | null = null;
        const before = Date.now();

        for (const waypoint of digit.waypoints) {
          if (waypoint.phase === 'dwell') {
            usePinStore.getState().setStatus({ state: 'DWELLING', stage: 'dwell' });
            await this.waitDwell(PIN_MOTION_CONFIG.contactDwellMs);
            continue;
          }

          const state =
            waypoint.phase === 'hover'
              ? 'HOVERING'
              : waypoint.phase === 'descent'
                ? 'DESCENDING'
                : waypoint.phase === 'contact'
                  ? 'CONTACT_VERIFY'
                  : waypoint.phase === 'retract'
                    ? 'RETRACTING'
                    : 'TRAVELLING';
          usePinStore.getState().setStatus({ state, stage: waypoint.label });

          await this.moveTo(waypoint);

          const actual = tcpSnapshot();
          if (!actual) throw new Error('No runtime TCP sample available');
          const error = distanceM(actual, waypoint.position);
          const ok = error <= (waypoint.phase === 'contact' ? PIN_MOTION_CONFIG.contactToleranceM : 0.01);
          if (!ok) {
            if (waypoint.phase === 'hover') hoverSuccess = false;
            else if (waypoint.phase === 'descent') descentSuccess = false;
            else if (waypoint.phase === 'contact') contactSuccess = false;
            else if (waypoint.phase === 'retract') retractSuccess = false;
            throw new Error(`${waypoint.phase} verification failed: ${(error * 1000).toFixed(2)} mm`);
          }
          if (waypoint.phase === 'contact') {
            contactActual = actual;
            contactWaypoint = waypoint;
          }
        }

        if (!contactActual || !contactWaypoint) throw new Error(`No contact sample for key ${digit.key}`);
        const contactErrorM = distanceM(contactActual, digit.contactPoint);
        const evidence: PinPressEvidence = {
          runId,
          pin: plan.pin,
          digitIndex: digit.digitIndex,
          key: digit.key,
          target: digit.contactPoint,
          actual: contactActual,
          errorM: contactErrorM,
          errorMm: contactErrorM * 1000,
          stylusTiltDeg: (contactWaypoint.ik.tiltRad * 180) / Math.PI,
          hoverSuccess,
          descentSuccess,
          contactSuccess,
          retractSuccess,
          ikIterations: contactWaypoint.ik.iterations,
          solverStatus: contactWaypoint.ik.status,
          trajectoryDurationMs: Date.now() - before,
          dwellMs: PIN_MOTION_CONFIG.contactDwellMs,
          maximumJointDeltaRad: plan.maxJointDeltaRad,
          nearestJointLimitMarginRad: plan.minJointLimitMarginRad,
          failureReason: null,
        };
        report.presses.push(evidence);
        usePinStore.getState().setStatus({
          state: 'NEXT_DIGIT',
          report: { ...report, presses: [...report.presses] },
          elapsedMs: Date.now() - started,
        });
      }

      const completed: PinRunReport = {
        ...report,
        completedAtIso: new Date().toISOString(),
        outcome: 'passed',
      };
      usePinStore.getState().setStatus({ state: 'COMPLETED', report: completed, elapsedMs: Date.now() - started });
      usePinStore.getState().addReport(completed);
      return completed;
    } catch (error) {
      const eStopped = runtimeState()?.eStopped ?? false;
      const failed: PinRunReport = {
        ...report,
        completedAtIso: new Date().toISOString(),
        outcome: eStopped ? 'e_stopped' : this.cancelled ? 'cancelled' : 'failed',
        events: [...report.events, error instanceof Error ? error.message : String(error)],
      };
      usePinStore.getState().setStatus({
        state: eStopped ? 'E_STOPPED' : this.cancelled ? 'CANCELLED' : 'FAILED',
        error: failed.events.at(-1) ?? 'PIN failed',
        report: failed,
      });
      usePinStore.getState().addReport(failed);
      throw error;
    }
  }

  private async moveTo(waypoint: PinWaypoint): Promise<void> {
    const accepted = this.opts.runtime.submit({
      type: 'move_joints',
      source: 'autonomous',
      joints: waypoint.ik.solution,
    });
    if (!accepted.accepted) throw new Error(accepted.reason ?? 'Runtime rejected autonomous move');
    await this.waitForReady();
  }

  private async waitForReady(): Promise<void> {
    const start = Date.now();
    let observedRuntimeWork = false;
    while (Date.now() - start < 15000) {
      if (this.cancelled) throw new Error('PIN cancelled');
      while (this.paused) await sleep(50);
      const snapshot = runtimeState();
      if (snapshot?.eStopped) throw new Error('E-stop active');
      const state = this.opts.runtime.getState();
      if (state !== 'READY' || (snapshot?.activeCommand ?? null) || (snapshot?.queueLength ?? 0) > 0) {
        observedRuntimeWork = true;
      }
      if (
        observedRuntimeWork &&
        state === 'READY' &&
        !snapshot?.activeCommand &&
        (snapshot?.queueLength ?? 0) === 0
      ) {
        return;
      }
      await sleep(30);
    }
    throw new Error('Timed out waiting for runtime READY');
  }

  private async waitDwell(ms: number): Promise<void> {
    let remaining = ms;
    while (remaining > 0) {
      if (this.cancelled) throw new Error('PIN cancelled');
      while (this.paused) await sleep(50);
      const step = Math.min(25, remaining);
      await sleep(step);
      remaining -= step;
    }
  }
}
