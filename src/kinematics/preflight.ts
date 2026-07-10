import type { KinematicChain } from './chainTypes';
import { solveIK } from './ikSolver';
import type { IkOptions, IkResult } from './ikTypes';
import type { Vec3 } from './spatial';

export interface PreflightRequest {
  /** Key id → contact point (base frame, metres). */
  readonly keys: Readonly<Record<string, Vec3>>;
  /** Desired approach direction (defines the TCP approach/retract path). */
  readonly approachAxis: Vec3;
  readonly activeJoints: readonly string[];
  readonly lockedValues: Readonly<Record<string, number>>;
  /** Height above the contact point for the hover pose (metres). */
  readonly hoverDistance: number;
  /** Number of descent segments between hover and contact. */
  readonly descentSteps: number;
  readonly options?: Partial<IkOptions>;
}

export interface WaypointResult {
  readonly label: string;
  readonly phase: 'hover' | 'descent' | 'contact' | 'retract';
  readonly position: Vec3;
  readonly result: IkResult;
}

export interface KeyPreflightResult {
  readonly key: string;
  readonly reachable: boolean;
  readonly hoverSuccess: boolean;
  readonly descentSuccess: boolean;
  readonly contactSuccess: boolean;
  readonly retractSuccess: boolean;
  readonly worstPositionError: number;
  readonly worstTiltRad: number;
  /** Largest |Δq| between consecutive waypoint solutions (smoothness). */
  readonly maxJointDelta: number;
  /** Smallest joint-limit margin across all waypoint solutions. */
  readonly minJointLimitMargin: number;
  readonly waypoints: WaypointResult[];
}

export interface PreflightResult {
  readonly keys: KeyPreflightResult[];
  readonly allReachable: boolean;
}

interface Waypoint {
  label: string;
  phase: WaypointResult['phase'];
  position: Vec3;
}

/** Hover → descent → contact → retract waypoints for one key. */
export function keyWaypoints(
  contact: Vec3,
  approach: Vec3,
  hoverDistance: number,
  descentSteps: number,
): Waypoint[] {
  const dlen = Math.hypot(approach[0], approach[1], approach[2]) || 1;
  const d: Vec3 = [approach[0] / dlen, approach[1] / dlen, approach[2] / dlen];
  // Hover sits "above" the key, opposite the approach direction.
  const hover: Vec3 = [
    contact[0] - d[0] * hoverDistance,
    contact[1] - d[1] * hoverDistance,
    contact[2] - d[2] * hoverDistance,
  ];
  const lerp = (t: number): Vec3 => [
    hover[0] + (contact[0] - hover[0]) * t,
    hover[1] + (contact[1] - hover[1]) * t,
    hover[2] + (contact[2] - hover[2]) * t,
  ];

  const points: Waypoint[] = [{ label: 'hover', phase: 'hover', position: hover }];
  // Descent hover → contact along +approach (global -Z for this task).
  for (let i = 1; i <= descentSteps; i++) {
    const t = i / descentSteps;
    points.push(
      i === descentSteps
        ? { label: 'contact', phase: 'contact', position: contact }
        : { label: `descent-${i}`, phase: 'descent', position: lerp(t) },
    );
  }
  // Retract contact → hover along -approach (global +Z).
  for (let i = 1; i <= descentSteps; i++) {
    const t = 1 - i / descentSteps;
    points.push({
      label: i === descentSteps ? 'retract-hover' : `retract-${i}`,
      phase: 'retract',
      position: lerp(t),
    });
  }
  return points;
}

/** Solve one key's waypoints, warm-starting each from the previous solution. */
export function preflightKey(
  chain: KinematicChain,
  key: string,
  contact: Vec3,
  request: PreflightRequest,
): KeyPreflightResult {
  const points = keyWaypoints(contact, request.approachAxis, request.hoverDistance, request.descentSteps);
  const waypoints: WaypointResult[] = [];
  let seed: Record<string, number> | undefined;
  let prevSolution: Record<string, number> | undefined;

  let worstPositionError = 0;
  let worstTiltRad = 0;
  let maxJointDelta = 0;
  let minJointLimitMargin = Infinity;
  let hoverSuccess = true;
  let descentSuccess = true;
  let contactSuccess = true;
  let retractSuccess = true;

  for (const point of points) {
    const result = solveIK(chain, {
      target: { position: point.position, approachAxis: request.approachAxis },
      activeJoints: request.activeJoints,
      lockedValues: request.lockedValues,
      seed,
      options: request.options,
    });
    waypoints.push({ label: point.label, phase: point.phase, position: point.position, result });

    worstPositionError = Math.max(worstPositionError, result.positionError);
    worstTiltRad = Math.max(worstTiltRad, result.tiltRad);
    if (Number.isFinite(result.jointLimitMargin)) {
      minJointLimitMargin = Math.min(minJointLimitMargin, result.jointLimitMargin);
    }

    // Smoothness: max |Δq| vs the previous waypoint solution.
    if (prevSolution) {
      let delta = 0;
      for (const name of request.activeJoints) {
        delta = Math.max(delta, Math.abs((result.solution[name] ?? 0) - (prevSolution[name] ?? 0)));
      }
      maxJointDelta = Math.max(maxJointDelta, delta);
    }

    if (!result.verified) {
      if (point.phase === 'hover') hoverSuccess = false;
      else if (point.phase === 'descent') descentSuccess = false;
      else if (point.phase === 'contact') contactSuccess = false;
      else retractSuccess = false;
    }

    // Sequential seeding for smooth orientation changes between poses.
    if (result.verified) {
      seed = result.solution;
      prevSolution = result.solution;
    }
  }

  const reachable = hoverSuccess && descentSuccess && contactSuccess && retractSuccess;
  return {
    key,
    reachable,
    hoverSuccess,
    descentSuccess,
    contactSuccess,
    retractSuccess,
    worstPositionError,
    worstTiltRad,
    maxJointDelta,
    minJointLimitMargin,
    waypoints,
  };
}

/** Synchronous preflight of all keys. */
export function runPreflight(chain: KinematicChain, request: PreflightRequest): PreflightResult {
  const keys = Object.entries(request.keys).map(([key, contact]) =>
    preflightKey(chain, key, contact, request),
  );
  return { keys, allReachable: keys.every((k) => k.reachable) };
}

const macrotaskYield = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Cancellable preflight for the worker. Yields to the event loop between keys so
 * a pending cancel message can be delivered and observed via `shouldCancel`.
 */
export async function runPreflightCancellable(
  chain: KinematicChain,
  request: PreflightRequest,
  shouldCancel: () => boolean,
  yieldFn: () => Promise<void> = macrotaskYield,
): Promise<PreflightResult | { cancelled: true }> {
  const keys: KeyPreflightResult[] = [];
  for (const [key, contact] of Object.entries(request.keys)) {
    if (shouldCancel()) return { cancelled: true };
    await yieldFn();
    if (shouldCancel()) return { cancelled: true };
    keys.push(preflightKey(chain, key, contact, request));
  }
  return { keys, allReachable: keys.every((k) => k.reachable) };
}
