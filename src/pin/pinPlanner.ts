import type { KeyConfig } from '../config/keyConfig';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import type { KinematicChain } from '../kinematics/chainTypes';
import { solveIK } from '../kinematics/ikSolver';
import type { IkResult } from '../kinematics/ikTypes';
import type { Vec3 } from '../kinematics/spatial';
import { approachUnitVector, coordToTuple } from '../scene/coordinates';
import { PIN_MOTION_CONFIG } from './pinConfig';

export type PinWaypointPhase = 'travel' | 'hover' | 'descent' | 'contact' | 'dwell' | 'retract';

export interface PinWaypoint {
  readonly digitIndex: number;
  readonly key: string;
  readonly label: string;
  readonly phase: PinWaypointPhase;
  readonly position: Vec3;
  readonly ik: IkResult;
}

export interface PinPlanDigit {
  readonly digitIndex: number;
  readonly key: string;
  readonly contactPoint: Vec3;
  readonly hoverPoint: Vec3;
  readonly waypoints: PinWaypoint[];
}

export interface PinPlan {
  readonly pin: string;
  readonly approachAxis: Vec3;
  readonly digits: PinPlanDigit[];
  readonly waypoints: PinWaypoint[];
  readonly allVerified: boolean;
  readonly worstPositionErrorM: number;
  readonly worstTiltRad: number;
  readonly maxJointDeltaRad: number;
  readonly minJointLimitMarginRad: number;
  readonly failureReason: string | null;
}

function addScaled(point: Vec3, axis: Vec3, scale: number): Vec3 {
  return [point[0] + axis[0] * scale, point[1] + axis[1] * scale, point[2] + axis[2] * scale];
}

function maxJointDelta(a: Record<string, number> | null, b: Record<string, number>): number {
  if (!a) return 0;
  let max = 0;
  for (const name of COMPETITION_6DOF.activeJoints) {
    max = Math.max(max, Math.abs((b[name] ?? 0) - (a[name] ?? 0)));
  }
  return max;
}

function descentStepCount(): number {
  return Math.max(
    1,
    Math.ceil(PIN_MOTION_CONFIG.hoverClearanceM / PIN_MOTION_CONFIG.descentWaypointSpacingM),
  );
}

export function planPinSequence(chain: KinematicChain, keyConfig: KeyConfig, pin: string): PinPlan {
  const approachAxis = approachUnitVector(keyConfig.approach_axis);
  const digits: PinPlanDigit[] = [];
  const waypoints: PinWaypoint[] = [];
  let seed: Record<string, number> | undefined;
  let previousSolution: Record<string, number> | null = null;
  let allVerified = true;
  let worstPositionErrorM = 0;
  let worstTiltRad = 0;
  let maxDelta = 0;
  let minJointLimitMarginRad = Infinity;
  let failureReason: string | null = null;
  const steps = descentStepCount();

  for (let digitIndex = 0; digitIndex < pin.length; digitIndex++) {
    const key = pin[digitIndex]!;
    const coord = keyConfig.keys[key];
    if (!coord) {
      allVerified = false;
      failureReason = `Key ${key} is not configured`;
      break;
    }

    const contactPoint = coordToTuple(coord);
    const hoverPoint = addScaled(contactPoint, approachAxis, -PIN_MOTION_CONFIG.hoverClearanceM);
    const safePoint = addScaled(contactPoint, approachAxis, -PIN_MOTION_CONFIG.safeRetreatClearanceM);
    const raw: Array<{ label: string; phase: PinWaypointPhase; position: Vec3 }> = [
      { label: 'safe-travel', phase: 'travel', position: safePoint },
      { label: 'hover', phase: 'hover', position: hoverPoint },
    ];

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      raw.push({
        label: step === steps ? 'contact' : `descent-${step}`,
        phase: step === steps ? 'contact' : 'descent',
        position: [
          hoverPoint[0] + (contactPoint[0] - hoverPoint[0]) * t,
          hoverPoint[1] + (contactPoint[1] - hoverPoint[1]) * t,
          hoverPoint[2] + (contactPoint[2] - hoverPoint[2]) * t,
        ],
      });
    }
    raw.push({ label: 'dwell', phase: 'dwell', position: contactPoint });
    for (let step = 1; step <= steps; step++) {
      const t = 1 - step / steps;
      raw.push({
        label: step === steps ? 'retract-hover' : `retract-${step}`,
        phase: 'retract',
        position: [
          hoverPoint[0] + (contactPoint[0] - hoverPoint[0]) * t,
          hoverPoint[1] + (contactPoint[1] - hoverPoint[1]) * t,
          hoverPoint[2] + (contactPoint[2] - hoverPoint[2]) * t,
        ],
      });
    }

    const planned: PinWaypoint[] = [];
    for (const item of raw) {
      const ik = solveIK(chain, {
        target: { position: item.position, approachAxis },
        activeJoints: COMPETITION_6DOF.activeJoints,
        lockedValues: COMPETITION_6DOF.lockedJoints,
        seed,
        options: {
          positionTolerance: 0.002,
          preferredTiltRad: PIN_MOTION_CONFIG.preferredStylusTiltRad,
          maxTiltRad: PIN_MOTION_CONFIG.maxStylusTiltRad,
        },
      });
      const waypoint: PinWaypoint = { digitIndex, key, ...item, ik };
      planned.push(waypoint);
      waypoints.push(waypoint);

      worstPositionErrorM = Math.max(worstPositionErrorM, ik.positionError);
      worstTiltRad = Math.max(worstTiltRad, ik.tiltRad);
      if (Number.isFinite(ik.jointLimitMargin)) {
        minJointLimitMarginRad = Math.min(minJointLimitMarginRad, ik.jointLimitMargin);
      }
      maxDelta = Math.max(maxDelta, maxJointDelta(previousSolution, ik.solution));

      if (!ik.verified && !failureReason) {
        allVerified = false;
        failureReason = `IK failed for key ${key} ${item.label}: ${ik.status}`;
      }
      if (ik.verified) {
        seed = ik.solution;
        previousSolution = ik.solution;
      }
    }

    digits.push({ digitIndex, key, contactPoint, hoverPoint, waypoints: planned });
  }

  return {
    pin,
    approachAxis,
    digits,
    waypoints,
    allVerified,
    worstPositionErrorM,
    worstTiltRad,
    maxJointDeltaRad: maxDelta,
    minJointLimitMarginRad,
    failureReason,
  };
}
