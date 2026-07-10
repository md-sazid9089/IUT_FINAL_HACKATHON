import type { CommandSource } from '../runtime/commands';
import { isManualSource } from '../runtime/commands';
import type { RuntimeState } from '../runtime/runtimeState';

/**
 * A three-dimensional Cartesian vector in the robot base frame.
 *
 * X = left/right
 * Y = forward/backward
 * Z = up/down
 */
export type Vec3 = [number, number, number];

export type SpeedMode = 'precision' | 'normal' | 'fast';

/**
 * Maximum Cartesian movement generated on every joystick/runtime tick.
 *
 * Precision = 1 mm
 * Normal    = 5 mm
 * Fast      = 10 mm
 */
export const SPEED_INCREMENTS: Record<SpeedMode, number> = {
  precision: 0.001,
  normal: 0.005,
  fast: 0.01,
};

export const SPEED_ORDER: readonly SpeedMode[] = [
  'precision',
  'normal',
  'fast',
];

export const DEFAULT_SPEED_MODE: SpeedMode = 'normal';

/**
 * Joystick movements smaller than 15% are ignored.
 *
 * This prevents small mouse/touch inaccuracies from moving the robot.
 */
export const DEFAULT_DEAD_ZONE = 0.15;

/**
 * Manual commands are generated 20 times per second.
 */
export const JOG_RATE_HZ = 20;

/**
 * Default stylus direction.
 *
 * The stylus continues pointing toward global -Z while Cartesian IK changes
 * the TCP position.
 */
export const DEFAULT_APPROACH_AXIS: Vec3 = [0, 0, -1];

/**
 * Keyboard mapping in the base_link coordinate frame.
 */
export const MOVE_KEYS: Readonly<Record<string, Vec3>> = {
  w: [0, 1, 0],
  s: [0, -1, 0],
  a: [-1, 0, 0],
  d: [1, 0, 0],
  r: [0, 0, 1],
  f: [0, 0, -1],
};

export function isMoveKey(key: string): boolean {
  return key.toLowerCase() in MOVE_KEYS;
}

export function magnitude(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

/**
 * Convert held keyboard keys into one combined direction.
 *
 * Examples:
 *
 * W       → [0, 1, 0]
 * D       → [1, 0, 0]
 * W + D   → [1, 1, 0]
 * W + S   → [0, 0, 0]
 */
export function keysToDirection(keys: Iterable<string>): Vec3 {
  const direction: Vec3 = [0, 0, 0];

  for (const key of keys) {
    const movement = MOVE_KEYS[key.toLowerCase()];

    if (!movement) {
      continue;
    }

    direction[0] += movement[0];
    direction[1] += movement[1];
    direction[2] += movement[2];
  }

  return direction;
}

/**
 * Apply a radial joystick dead zone while preserving the exact direction.
 *
 * This is important for diagonal movement.
 *
 * Full upper-right joystick:
 *
 * raw vector        = [1, 1, 0]
 * unit direction    = [0.7071, 0.7071, 0]
 *
 * Therefore, the robot travels exactly at 45 degrees without moving faster
 * than a straight horizontal or vertical movement.
 *
 * Joystick distance from the centre also controls speed:
 *
 * small displacement → slow movement
 * full displacement  → full selected speed
 */
export function normalizeDirection(
  vector: Vec3,
  deadZone: number = DEFAULT_DEAD_ZONE,
): Vec3 {
  const rawMagnitude = magnitude(vector);

  /**
   * Ignore tiny joystick movement near the centre.
   */
  if (!Number.isFinite(rawMagnitude) || rawMagnitude <= deadZone) {
    return [0, 0, 0];
  }

  /**
   * Keep the original joystick strength when it is between the dead zone
   * and the outer boundary.
   *
   * Examples:
   * [0.5, 0, 0] remains [0.5, 0, 0]
   * [0, 0.5, 0] remains [0, 0.5, 0]
   */
  if (rawMagnitude <= 1) {
    return [
      vector[0],
      vector[1],
      vector[2],
    ];
  }

  /**
   * Clamp vectors outside the joystick circle to length 1.
   *
   * Example:
   * [1, 1, 0] becomes approximately:
   * [0.7071, 0.7071, 0]
   *
   * This preserves the 45-degree direction while preventing diagonal
   * movement from becoming faster than straight movement.
   */
  return [
    vector[0] / rawMagnitude,
    vector[1] / rawMagnitude,
    vector[2] / rawMagnitude,
  ];
}

/**
 * Convert the joystick direction into a Cartesian TCP displacement.
 *
 * This function does not calculate joint angles. It generates the desired
 * stylus-tip movement. RuntimeController then sends the resulting target to
 * the inverse-kinematics worker.
 */
export function buildJogDelta(
  rawDirection: Vec3,
  maximumStepMeters: number,
  deadZone: number = DEFAULT_DEAD_ZONE,
): Vec3 {
  const direction = normalizeDirection(rawDirection, deadZone);

  return [
    direction[0] * maximumStepMeters,
    direction[1] * maximumStepMeters,
    direction[2] * maximumStepMeters,
  ];
}

/**
 * Return the horizontal joystick direction in degrees.
 *
 * 0°   = right
 * 45°  = upper-right
 * 90°  = up
 * 180° = left
 * -90° = down
 */
export function joystickAngleDegrees(x: number, y: number): number | null {
  const length = Math.hypot(x, y);

  if (length <= DEFAULT_DEAD_ZONE) {
    return null;
  }

  return (Math.atan2(y, x) * 180) / Math.PI;
}

export interface JogCommand {
  readonly type: 'cartesian_jog';
  readonly source: Extract<CommandSource, 'joystick' | 'keyboard'>;

  /**
   * Relative stylus-tip movement in metres, expressed in base_link.
   */
  readonly delta: Vec3;

  /**
   * Current desired stylus direction.
   */
  readonly approachAxis: Vec3;
}

export function jogCommand(
  source: JogCommand['source'],
  delta: Vec3,
  approachAxis: Vec3 = DEFAULT_APPROACH_AXIS,
): JogCommand {
  return {
    type: 'cartesian_jog',
    source,
    delta,
    approachAxis,
  };
}

export type ManualGateStatus = 'allowed' | 'busy' | 'blocked';

export interface ManualGate {
  readonly status: ManualGateStatus;
  readonly reason?: string;
}

/**
 * Determine whether the manual controller may currently submit movement.
 */
export function manualJogGate(
  state: RuntimeState,
  activeSource: CommandSource | null,
): ManualGate {
  const manualOrIdle = (source: CommandSource | null): boolean =>
    source === null || isManualSource(source);

  switch (state) {
    case 'READY':
      return {
        status: 'allowed',
      };

    case 'EXECUTING':
      if (manualOrIdle(activeSource)) {
        return {
          status: 'allowed',
        };
      }

      return {
        status: 'blocked',
        reason:
          `Manual blocked: ${activeSource} owns motion — ` +
          'cancel it before using the joystick',
      };

    case 'PLANNING':
      if (manualOrIdle(activeSource)) {
        return {
          status: 'busy',
        };
      }

      return {
        status: 'blocked',
        reason:
          `Manual blocked: ${activeSource} owns motion — ` +
          'cancel it before using the joystick',
      };

    case 'STOPPING':
      return {
        status: 'busy',
      };

    case 'PAUSED':
      return {
        status: 'blocked',
        reason: 'Manual blocked: runtime is paused',
      };

    case 'E_STOPPED':
      return {
        status: 'blocked',
        reason: 'Manual blocked: E-stop is active — reset required',
      };

    case 'FAULT':
      return {
        status: 'blocked',
        reason: 'Manual blocked: runtime is in a fault state',
      };

    case 'BOOTING':
    case 'MODEL_LOADING':
    case 'SELF_TEST':
    default:
      return {
        status: 'blocked',
        reason: `Manual blocked: runtime is ${state}`,
      };
  }
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}