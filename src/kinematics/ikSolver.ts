import type { KinematicChain } from './chainTypes';
import { computeForwardKinematics, type JointValues } from './forwardKinematics';
import { evaluateKeyPressTask, toolAxisBasis, type ToolAxisBasis } from './jacobian';
import { choleskyFactor, choleskySolve } from './linalg/cholesky';
import { addScaledIdentity, matVec, multiplyABt, transposeMatVec } from './linalg/smallMatrix';
import { activeJointBounds, buildSeeds, type JointBound } from './seeds';
import {
  DEFAULT_IK_OPTIONS,
  type IkOptions,
  type IkRequest,
  type IkResult,
  type IkStatus,
  type UnsafeJump,
} from './ikTypes';
import type { Vec3 } from './spatial';

const TASK_ROWS = 5;

/** Preallocated Float64 workspace for one DLS solve (reused across iterations). */
class DlsWorkspace {
  readonly jac6: Float64Array;
  readonly J: Float64Array;
  readonly A: Float64Array;
  readonly L: Float64Array;
  readonly e: Float64Array;
  readonly y: Float64Array;
  readonly cholScratch: Float64Array;
  readonly dq: Float64Array;
  readonly z: Float64Array;
  readonly Jz: Float64Array;
  readonly yz: Float64Array;
  readonly q: Float64Array;
  readonly qNew: Float64Array;

  constructor(readonly n: number) {
    this.jac6 = new Float64Array(6 * n);
    this.J = new Float64Array(TASK_ROWS * n);
    this.A = new Float64Array(TASK_ROWS * TASK_ROWS);
    this.L = new Float64Array(TASK_ROWS * TASK_ROWS);
    this.e = new Float64Array(TASK_ROWS);
    this.y = new Float64Array(TASK_ROWS);
    this.cholScratch = new Float64Array(TASK_ROWS);
    this.dq = new Float64Array(n);
    this.z = new Float64Array(n);
    this.Jz = new Float64Array(TASK_ROWS);
    this.yz = new Float64Array(TASK_ROWS);
    this.q = new Float64Array(n);
    this.qNew = new Float64Array(n);
  }
}

function isFiniteVec3(v: Vec3): boolean {
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);
}

function buildJointValues(
  activeJoints: readonly string[],
  q: Float64Array,
  locked: Readonly<Record<string, number>>,
): JointValues {
  const values: Record<string, number> = { ...locked };
  for (let i = 0; i < activeJoints.length; i++) {
    values[activeJoints[i]!] = q[i]!;
  }
  return values;
}

interface TaskSample {
  positionError: number;
  tiltRad: number;
  toolAxisDot: number;
}

function evaluate(
  chain: KinematicChain,
  activeJoints: readonly string[],
  q: Float64Array,
  locked: Readonly<Record<string, number>>,
  target: Vec3,
  basis: ToolAxisBasis,
  ws: DlsWorkspace,
  axisWeight: number,
): TaskSample {
  const fk = computeForwardKinematics(chain, buildJointValues(activeJoints, q, locked));
  const t = evaluateKeyPressTask(fk, activeJoints, target, basis, ws.jac6, ws.J, ws.e);
  // Soft-weight the two tool-axis rows so position stays the primary hard task
  // and stylus tilt is only minimised as a preference.
  const n = activeJoints.length;
  for (let j = 0; j < n; j++) {
    ws.J[3 * n + j] = ws.J[3 * n + j]! * axisWeight;
    ws.J[4 * n + j] = ws.J[4 * n + j]! * axisWeight;
  }
  ws.e[3] = ws.e[3]! * axisWeight;
  ws.e[4] = ws.e[4]! * axisWeight;
  return {
    positionError: t.positionError,
    tiltRad: t.axisError,
    toolAxisDot: t.toolAxisDot,
  };
}

/**
 * Errors-only evaluation for trial steps — does NOT touch the working Jacobian
 * (`ws.J`) or error (`ws.e`) buffers, so a rejected trial cannot corrupt the
 * damping-retry state at the current pose.
 */
function evaluateErrors(
  chain: KinematicChain,
  activeJoints: readonly string[],
  q: Float64Array,
  locked: Readonly<Record<string, number>>,
  target: Vec3,
  basis: ToolAxisBasis,
): TaskSample {
  const fk = computeForwardKinematics(chain, buildJointValues(activeJoints, q, locked));
  const p = fk.tcp.position;
  const a = toolAxisFromPoseTuple(fk.tcp.quaternion);
  const positionError = Math.hypot(
    target[0] - p[0],
    target[1] - p[1],
    target[2] - p[2],
  );
  const dot = Math.min(1, Math.max(-1, a[0] * basis.d[0] + a[1] * basis.d[1] + a[2] * basis.d[2]));
  return { positionError, tiltRad: Math.acos(dot), toolAxisDot: dot };
}

/** Tool axis (local +Z) from a quaternion, without importing extra helpers. */
function toolAxisFromPoseTuple(q: readonly [number, number, number, number]): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (x * z + w * y);
  const ty = 2 * (y * z - w * x);
  const tz = 1 - 2 * (x * x + y * y);
  const len = Math.hypot(tx, ty, tz) || 1;
  return [tx / len, ty / len, tz / len];
}

/** Objective for accept/reject: position (hard) plus soft tilt preference. */
function totalError(sample: TaskSample, axisWeight: number): number {
  return sample.positionError + axisWeight * sample.tiltRad;
}

function clampInto(q: Float64Array, bounds: JointBound[], out: Float64Array): void {
  for (let i = 0; i < q.length; i++) {
    out[i] = Math.min(bounds[i]!.upper, Math.max(bounds[i]!.lower, q[i]!));
  }
}

/**
 * Solve inverse kinematics for the five-constraint key-press task using weighted
 * damped least squares / Levenberg–Marquardt with adaptive damping, rejected
 * step retry, per-joint clamping, legal-limit projection, and a nullspace
 * midrange posture objective (joint-limit avoidance).
 *
 * Multiple deterministic seeds are tried in order; the first that converges is
 * returned. The final pose is verified with an independent FK evaluation.
 *
 * This runs off the main thread (inside the IK worker). It never hardcodes
 * joint solutions.
 */
export function solveIK(chain: KinematicChain, request: IkRequest): IkResult {
  const options: IkOptions = { ...DEFAULT_IK_OPTIONS, ...request.options };
  const { activeJoints, lockedValues } = request;

  // ---- validation ----
  const invalid = (message: string): IkResult => ({
    status: 'invalid',
    solution: {},
    jointValues: {},
    iterations: 0,
    seedIndex: -1,
    positionError: NaN,
    tiltRad: NaN,
    toolAxisDot: NaN,
    verified: false,
    jointLimitMargin: NaN,
    unsafeJump: null,
    message,
  });

  if (activeJoints.length === 0) return invalid('No active joints');
  if (!isFiniteVec3(request.target.position)) return invalid('Target position is not finite');
  const approach = request.target.approachAxis;
  if (!isFiniteVec3(approach) || Math.hypot(approach[0], approach[1], approach[2]) < 1e-9) {
    return invalid('Approach axis is zero or not finite');
  }
  for (const name of activeJoints) {
    if (!chain.joints.some((j) => j.name === name)) {
      return invalid(`Active joint "${name}" is not in the chain`);
    }
  }

  const bounds = activeJointBounds(chain, activeJoints);
  const basis = toolAxisBasis(approach);
  const target = request.target.position;
  const axisWeight = options.axisWeight;
  const n = activeJoints.length;
  const ws = new DlsWorkspace(n);
  // Reorientation (pitch) joints swing the tool through the vertical plane; grid
  // over them to guarantee the solver seeds both "reach-out" and "point-down"
  // basins for far targets.
  const gridJoints = activeJoints
    .map((name) => chain.joints.find((j) => j.name === name))
    .filter((j): j is NonNullable<typeof j> => !!j)
    .map((j) => ({ name: j.name, yness: Math.abs(j.axis[1]) }))
    .filter((j) => j.yness > 0.5)
    .map((j) => j.name);
  const seeds = buildSeeds(bounds, request.seed, options.seedCandidates ?? 12, gridJoints);

  // Null-space posture attractor: preferred reference (bent elbow etc.) when
  // provided, otherwise the joint midrange. Precomputed once per solve.
  const postureTarget = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const ref = options.postureReference?.[activeJoints[i]!];
    postureTarget[i] = ref ?? (bounds[i]!.lower + bounds[i]!.upper) / 2;
  }

  let best: { sample: TaskSample; q: Float64Array; iterations: number; seedIndex: number } | null =
    null;
  let lastNonConvergedStatus: IkStatus = 'max_iterations';

  for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
    clampInto(Float64Array.from(seeds[seedIndex]!), bounds, ws.q);
    let lambda = options.initialLambda;
    // Full task at the seed pose (writes ws.J / ws.e).
    let sample = evaluate(chain, activeJoints, ws.q, lockedValues, target, basis, ws, axisWeight);
    let iterations = 0;
    let status: IkStatus = 'max_iterations';

    for (; iterations < options.maxIterations; iterations++) {
      // Primary hard task is position. Stop early only when the tilt preference
      // is also met; otherwise keep minimising tilt until the step stagnates.
      if (
        sample.positionError <= options.positionTolerance &&
        sample.tiltRad <= options.preferredTiltRad
      ) {
        status = 'converged';
        break;
      }

      // ws.J / ws.e already correspond to the current pose ws.q.
      let accepted = false;
      let retries = 0;
      const currentTotal = totalError(sample, axisWeight);

      while (retries < 40) {
        // A = J Jᵀ + λ² I
        multiplyABt(ws.J, TASK_ROWS, n, ws.A);
        addScaledIdentity(ws.A, TASK_ROWS, lambda * lambda);

        if (!choleskyFactor(ws.A, TASK_ROWS, ws.L)) {
          lambda = Math.min(options.lambdaMax, lambda * 10);
          retries++;
          if (lambda >= options.lambdaMax) {
            status = 'diverged';
            break;
          }
          continue;
        }

        // Δq = Jᵀ (A⁻¹ e), solved via Cholesky.
        choleskySolve(ws.L, TASK_ROWS, ws.e, ws.y, ws.cholScratch);
        transposeMatVec(ws.J, TASK_ROWS, n, ws.y, ws.dq);

        // Nullspace posture objective: Δq += g · (z − Jᵀ A⁻¹ J z), where z pulls
        // toward the posture target (preferred reference or joint midrange).
        if (options.posture === 'midrange') {
          for (let i = 0; i < n; i++) {
            ws.z[i] = postureTarget[i]! - ws.q[i]!;
          }
          matVec(ws.J, TASK_ROWS, n, ws.z, ws.Jz);
          choleskySolve(ws.L, TASK_ROWS, ws.Jz, ws.yz, ws.cholScratch);
          for (let i = 0; i < n; i++) {
            let jtY = 0;
            for (let r = 0; r < TASK_ROWS; r++) jtY += ws.J[r * n + i]! * ws.yz[r]!;
            ws.dq[i] = ws.dq[i]! + options.postureGain * (ws.z[i]! - jtY);
          }
        }

        // Per-joint step clamp, then legal-limit projection.
        for (let i = 0; i < n; i++) {
          if (ws.dq[i]! > options.maxStep) ws.dq[i] = options.maxStep;
          else if (ws.dq[i]! < -options.maxStep) ws.dq[i] = -options.maxStep;
          ws.qNew[i] = ws.q[i]! + ws.dq[i]!;
        }
        clampInto(ws.qNew, bounds, ws.qNew);

        // Errors-only trial — does not disturb ws.J / ws.e.
        const trial = evaluateErrors(chain, activeJoints, ws.qNew, lockedValues, target, basis);
        if (totalError(trial, axisWeight) < currentTotal) {
          ws.q.set(ws.qNew);
          sample = trial;
          lambda = Math.max(options.initialLambda * 1e-3, lambda * 0.5);
          accepted = true;
          break;
        }
        // Reject: increase damping and retry (J / e unchanged).
        lambda = Math.min(options.lambdaMax, lambda * 2);
        retries++;
        if (lambda >= options.lambdaMax) {
          status = 'diverged';
          break;
        }
      }

      if (!accepted) {
        // Step can no longer improve. If position is already within tolerance,
        // this is a valid minimal-tilt solution; otherwise it is a real stall.
        if (sample.positionError <= options.positionTolerance) {
          status = 'converged';
        } else {
          status = status === 'diverged' ? 'diverged' : 'stagnation';
        }
        break;
      }
      // Refresh the full task (J / e) at the accepted pose for the next iteration.
      sample = evaluate(chain, activeJoints, ws.q, lockedValues, target, basis, ws, axisWeight);
    }

    if (status === 'converged') {
      return finalize(chain, activeJoints, ws.q, lockedValues, target, basis, ws, bounds, iterations, seedIndex, options, seeds[0]!, 'converged');
    }
    lastNonConvergedStatus = status;
    if (!best || totalError(sample, axisWeight) < totalError(best.sample, axisWeight)) {
      best = { sample, q: Float64Array.from(ws.q), iterations, seedIndex };
    }
  }

  // No seed converged — return the best effort, clearly not verified.
  const b = best!;
  ws.q.set(b.q);
  return finalize(
    chain,
    activeJoints,
    ws.q,
    lockedValues,
    target,
    basis,
    ws,
    bounds,
    b.iterations,
    b.seedIndex,
    options,
    seeds[0]!,
    lastNonConvergedStatus,
  );
}

function finalize(
  chain: KinematicChain,
  activeJoints: readonly string[],
  q: Float64Array,
  locked: Readonly<Record<string, number>>,
  target: Vec3,
  basis: ToolAxisBasis,
  ws: DlsWorkspace,
  bounds: JointBound[],
  iterations: number,
  seedIndex: number,
  options: IkOptions,
  primarySeed: number[],
  status: IkStatus,
): IkResult {
  const solution: Record<string, number> = {};
  for (let i = 0; i < activeJoints.length; i++) solution[activeJoints[i]!] = q[i]!;
  const jointValues = buildJointValues(activeJoints, q, locked) as Record<string, number>;

  // Independent FK verification: recompute the pose from scratch and measure.
  const sample = evaluate(chain, activeJoints, q, locked, target, basis, ws, options.axisWeight);

  // Position is the hard requirement; tilt must stay within the bounded maximum.
  const verified =
    status === 'converged' &&
    sample.positionError <= options.positionTolerance &&
    sample.tiltRad <= options.maxTiltRad;

  // Nearest joint-limit margin across the active joints.
  let jointLimitMargin = Infinity;
  for (let i = 0; i < activeJoints.length; i++) {
    const b = bounds[i]!;
    jointLimitMargin = Math.min(jointLimitMargin, q[i]! - b.lower, b.upper - q[i]!);
  }

  // Unsafe joint-jump diagnostic vs the primary seed.
  let unsafeJump: UnsafeJump | null = null;
  let maxDelta = 0;
  for (let i = 0; i < activeJoints.length; i++) {
    const delta = Math.abs(q[i]! - (primarySeed[i] ?? 0));
    if (delta > maxDelta) {
      maxDelta = delta;
      if (delta > options.unsafeJumpThreshold) {
        unsafeJump = { joint: activeJoints[i]!, delta };
      }
    }
  }

  return {
    status,
    solution,
    jointValues,
    iterations,
    seedIndex,
    positionError: sample.positionError,
    tiltRad: sample.tiltRad,
    toolAxisDot: sample.toolAxisDot,
    verified,
    jointLimitMargin,
    unsafeJump,
  };
}
