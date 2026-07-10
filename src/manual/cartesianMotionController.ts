import {
  DEFAULT_DEAD_ZONE,
  magnitude,
  normalizeDirection,
  type Vec3,
} from './jogModel';

/**
 * Centralised Cartesian motion controller (industrial teach-pendant style).
 *
 * EVERY manual input — the three axis joysticks (X, Y, Z), the legacy 2D
 * sticks, the ±Z buttons, and the keyboard (via keysToDirection feeding the
 * same jog model) — normalises into the SAME relative TCP step here. The
 * output is a `cartesian_jog` command; the existing DLS IK solver decides how
 * all six joints move and the RuntimeController enforces every safety rule.
 * No input path ever writes a joint angle.
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
  /** True when all inputs are inside the dead zone (nothing to emit). */
  readonly idle: boolean;
}

export type CartesianAxis = 'x' | 'y' | 'z';

/**
 * Preferred manual posture (radians): a natural bent-elbow pose. Used as the
 * IK null-space attractor during manual teleoperation so the solver avoids
 * fully stretched, near-singular arm configurations. The warm-start seed (the
 * CURRENT joints, passed by the RuntimeController) remains the primary
 * continuity mechanism; this only biases the redundancy.
 */
export const PREFERRED_MANUAL_POSTURE: Readonly<Record<string, number>> = {
  joint_1: 0,
  joint_2: -Math.PI / 4, // -45°
  joint_3: Math.PI / 2, // +90° — bent elbow, never stretched
  joint_4: 0,
  joint_5: Math.PI / 4, // +45°
  joint_6: 0,
};

export class CartesianMotionController {
  /** Per-axis virtual joysticks (X, Y, Z), each ∈ [-1, 1]. */
  private readonly axes: Record<CartesianAxis, number> = { x: 0, y: 0, z: 0 };
  /** Legacy 2D position stick (x → ±X, y → ±Y). */
  private stick1: [number, number] = [0, 0];
  /** Legacy orientation stick (x → rotation, y → ±Z). */
  private stick2: [number, number] = [0, 0];
  private zButton = 0; // discrete ±Z (keyboard R/F, hold buttons)
  private readonly deadZone: number;

  constructor(deadZone: number = DEFAULT_DEAD_ZONE) {
    this.deadZone = deadZone;
  }

  // ---- input ----------------------------------------------------------------

  /** Single-axis virtual joystick: value ∈ [-1, 1] jogs TCP along that axis. */
  setAxis(axis: CartesianAxis, value: number): void {
    this.axes[axis] = clamp1(value);
  }

  clearAxis(axis: CartesianAxis): void {
    this.axes[axis] = 0;
  }

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
    this.axes.x = 0;
    this.axes.y = 0;
    this.axes.z = 0;
    this.stick1 = [0, 0];
    this.stick2 = [0, 0];
    this.zButton = 0;
  }

  // ---- state ------------------------------------------------------------------

  /** Combined raw 6-axis input (pre-normalisation). */
  input(): JoystickInput {
    return {
      x: clamp1(this.stick1[0] + this.axes.x),
      y: clamp1(this.stick1[1] + this.axes.y),
      z: this.zButton !== 0 ? this.zButton : clamp1(this.stick2[1] + this.axes.z),
      roll: 0,
      pitch: 0,
      yaw: this.stick2[0], // tool rotation maps to yaw about the tool axis
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
   * the CURRENT TCP pose — never a fixed coordinate, never home.
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
