import {
  DEFAULT_DEAD_ZONE,
  magnitude,
  normalizeDirection,
  type Vec3,
} from './jogModel';

/**
 * 3D Cartesian teleoperation controller (industrial teach-pendant style).
 *
 * This is the single translation point between raw joystick hardware values and
 * Cartesian TCP targets. It never touches joints: its output is a relative TCP
 * delta / absolute target pose that the ManualJogEngine submits as a validated
 * `cartesian_jog` command. The existing DLS IK worker then decides how every
 * joint moves, and the RuntimeController enforces all safety rules.
 *
 * Sticks:
 *  - Position stick (stick 1): x → TCP ±X, y → TCP ±Y.
 *  - Orientation stick (stick 2): y → TCP ±Z, x → tool rotation (Phase 1:
 *    displayed and carried in the target's orientation field, not yet driven —
 *    the command schema is position + approach axis; roll/pitch/yaw are wired
 *    through `CartesianTarget` so orientation control can be enabled without
 *    another refactor).
 */

export interface JoystickInput {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly roll: number;
  readonly pitch: number;
  readonly yaw: number;
}

export interface CartesianTarget {
  readonly position: { x: number; y: number; z: number };
  readonly orientation: { roll: number; pitch: number; yaw: number };
  readonly source: 'joystick';
}

export interface CartesianStep {
  /** Relative TCP step for this tick (metres, base frame), dead-zone filtered
   * and normalised so diagonals are never faster than a single axis. */
  readonly delta: Vec3;
  /** Absolute target pose = current TCP + delta (orientation carried through). */
  readonly target: CartesianTarget;
  /** True when the sticks are inside the dead zone (nothing to emit). */
  readonly idle: boolean;
}

export class CartesianJoystickController {
  private stick1: [number, number] = [0, 0]; // [x → ±X, y → ±Y]
  private stick2: [number, number] = [0, 0]; // [x → rotation, y → ±Z]
  private zButton = 0; // discrete ±Z (keyboard R/F, hold buttons)
  private readonly deadZone: number;

  constructor(deadZone: number = DEFAULT_DEAD_ZONE) {
    this.deadZone = deadZone;
  }

  // ---- input ----------------------------------------------------------------

  /** Position stick: x ∈ [-1,1] → TCP ±X, y ∈ [-1,1] → TCP ±Y. */
  setPositionStick(x: number, y: number): void {
    this.stick1 = [clamp1(x), clamp1(y)];
  }

  clearPositionStick(): void {
    this.stick1 = [0, 0];
  }

  /** Orientation stick: y ∈ [-1,1] → TCP ±Z, x ∈ [-1,1] → tool rotation. */
  setOrientationStick(x: number, y: number): void {
    this.stick2 = [clamp1(x), clamp1(y)];
  }

  clearOrientationStick(): void {
    this.stick2 = [0, 0];
  }

  /** Discrete Z hold (+1 up / −1 down); overrides the analog Z while pressed. */
  pressZ(dir: 1 | -1): void {
    this.zButton = dir;
  }

  releaseZ(): void {
    this.zButton = 0;
  }

  clearAll(): void {
    this.stick1 = [0, 0];
    this.stick2 = [0, 0];
    this.zButton = 0;
  }

  // ---- state ------------------------------------------------------------------

  /** Combined raw 6-axis input (pre-normalisation). */
  input(): JoystickInput {
    return {
      x: this.stick1[0],
      y: this.stick1[1],
      z: this.zButton !== 0 ? this.zButton : this.stick2[1],
      roll: 0,
      pitch: 0,
      yaw: this.stick2[0], // Phase 1: tool rotation maps to yaw about the tool axis
    };
  }

  /** Raw translation vector [x, y, z] (pre-normalisation, for UI display). */
  translation(): Vec3 {
    const i = this.input();
    return [i.x, i.y, i.z];
  }

  hasInput(): boolean {
    const i = this.input();
    return magnitude([i.x, i.y, i.z]) > this.deadZone || Math.abs(i.yaw) > this.deadZone;
  }

  // ---- target generation --------------------------------------------------------

  /**
   * Build the Cartesian step for one tick: dead-zone filter, clamp the 3D
   * translation to unit length (a full diagonal is never faster than a single
   * axis: [1,1] → [0.707, 0.707]), scale by `speed` (m per tick), and add to
   * the current TCP pose.
   */
  buildStep(currentTcp: Vec3, speed: number): CartesianStep {
    const i = this.input();
    const n = normalizeDirection([i.x, i.y, i.z], this.deadZone);
    const delta: Vec3 = [n[0] * speed, n[1] * speed, n[2] * speed];
    const idle = magnitude(delta) === 0;
    return {
      delta,
      idle,
      target: {
        position: {
          x: currentTcp[0] + delta[0],
          y: currentTcp[1] + delta[1],
          z: currentTcp[2] + delta[2],
        },
        // Orientation is carried through for the future RPY-capable pipeline.
        orientation: { roll: i.roll, pitch: i.pitch, yaw: i.yaw },
        source: 'joystick',
      },
    };
  }
}

function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
}
