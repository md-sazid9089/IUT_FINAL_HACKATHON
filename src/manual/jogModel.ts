import type { CommandSource } from '../runtime/commands';
import { isManualSource } from '../runtime/commands';
import type { RuntimeState } from '../runtime/runtimeState';

/**
 * Pure, framework-agnostic model shared by the XY joystick and the keyboard
 * controller. Both inputs normalise into the SAME Cartesian jog command so a
 * full joystick deflection and the equivalent key produce identical motion.
 *
 * No DOM, no React, no runtime coupling here — only value transforms. The
 * engine (ManualJogEngine) and the tests build on these functions.
 */

export type Vec3 = [number, number, number];

export type SpeedMode = 'precision' | 'normal' | 'fast';

/** Cartesian step (metres) applied per emitted jog for each speed mode. */
export const SPEED_INCREMENTS: Record<SpeedMode, number> = {
  precision: 0.001,
  normal: 0.005,
  fast: 0.01,
};

export const SPEED_ORDER: readonly SpeedMode[] = ['precision', 'normal', 'fast'];

export const DEFAULT_SPEED_MODE: SpeedMode = 'normal';

/** Fraction of full deflection below which the joystick is treated as centred. */
export const DEFAULT_DEAD_ZONE = 0.15;

/** Fixed jog-emission rate (Hz). Independent of OS/browser key repeat. */
export const JOG_RATE_HZ = 20;

/** Default TCP approach axis (stylus points down) when none is provided. */
export const DEFAULT_APPROACH_AXIS: Vec3 = [0, 0, -1];

/**
 * Movement-key → unit direction in the base frame.
 *   W = +Y, S = −Y, A = −X, D = +X, R = +Z, F = −Z
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

export function magnitude(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * Sum the unit directions of all held movement keys. Opposite keys cancel
 * exactly (W+S → 0 on Y, A+D → 0 on X, R+F → 0 on Z), so conflicting
 * directions never queue.
 */
export function keysToDirection(keys: Iterable<string>): Vec3 {
  const dir: Vec3 = [0, 0, 0];
  for (const k of keys) {
    const v = MOVE_KEYS[k.toLowerCase()];
    if (v) {
      dir[0] += v[0];
      dir[1] += v[1];
      dir[2] += v[2];
    }
  }
  return dir;
}

/**
 * Apply the dead zone and clamp to the unit sphere. A magnitude at or below the
 * dead zone yields zero; magnitudes above 1 (diagonals, over-deflection) are
 * scaled back to unit length so diagonal moves never exceed the axis speed.
 */
export function normalizeDirection(v: Vec3, deadZone: number = DEFAULT_DEAD_ZONE): Vec3 {
  const m = magnitude(v);
  if (m <= deadZone || m === 0) return [0, 0, 0];
  if (m <= 1) return [v[0], v[1], v[2]];
  return [v[0] / m, v[1] / m, v[2] / m];
}

/**
 * Build the Cartesian delta (metres) for a raw direction and speed. This is the
 * single normalisation point that guarantees joystick/keyboard equivalence.
 */
export function buildJogDelta(rawDir: Vec3, speed: number, deadZone: number = DEFAULT_DEAD_ZONE): Vec3 {
  const n = normalizeDirection(rawDir, deadZone);
  return [n[0] * speed, n[1] * speed, n[2] * speed];
}

export interface JogCommand {
  readonly type: 'cartesian_jog';
  readonly source: Extract<CommandSource, 'joystick' | 'keyboard'>;
  readonly delta: Vec3;
  readonly approachAxis: Vec3;
}

export function jogCommand(
  source: JogCommand['source'],
  delta: Vec3,
  approachAxis: Vec3 = DEFAULT_APPROACH_AXIS,
): JogCommand {
  return { type: 'cartesian_jog', source, delta, approachAxis };
}

export type ManualGateStatus = 'allowed' | 'busy' | 'blocked';

export interface ManualGate {
  /**
   * - `allowed`: a new jog may be emitted now — either the runtime is idle
   *   (READY) or a manual jog is already EXECUTING and the new step preempts it
   *   with a target a little further ahead, giving smooth continuous motion.
   * - `busy`: our OWN manual jog is still PLANNING (IK solving) — hold this tick
   *   so we don't cancel the in-flight solve. Not a rejection; keep the input.
   * - `blocked`: something else forbids manual motion (autonomous ownership,
   *   E-stop, fault, paused, booting…) — surface the reason and disable.
   */
  readonly status: ManualGateStatus;
  readonly reason?: string;
}

/**
 * Decide whether a manual jog may be emitted in the current runtime state. This
 * is UX gating layered on top of the runtime's own hard rejections (E-stop,
 * autonomous ownership, safety) — it never replaces them.
 *
 * A manual jog briefly enters PLANNING (IK) then EXECUTING. We allow emission
 * during EXECUTING so successive steps chain into continuous motion, but wait
 * during PLANNING so we never cancel an in-flight IK solve.
 */
export function manualJogGate(state: RuntimeState, activeSource: CommandSource | null): ManualGate {
  const manualOrIdle = (s: CommandSource | null) => s === null || isManualSource(s);
  switch (state) {
    case 'READY':
      return { status: 'allowed' };
    case 'EXECUTING':
      if (manualOrIdle(activeSource)) return { status: 'allowed' };
      return { status: 'blocked', reason: `Manual blocked: ${activeSource} owns motion — cancel it first` };
    case 'PLANNING':
      if (manualOrIdle(activeSource)) return { status: 'busy' };
      return { status: 'blocked', reason: `Manual blocked: ${activeSource} owns motion — cancel it first` };
    case 'STOPPING':
      return { status: 'busy' };
    case 'PAUSED':
      return { status: 'blocked', reason: 'Manual blocked: runtime is PAUSED (resume or stop first)' };
    case 'E_STOPPED':
      return { status: 'blocked', reason: 'Manual blocked: E-STOPPED — reset required' };
    case 'FAULT':
      return { status: 'blocked', reason: 'Manual blocked: runtime FAULT' };
    case 'BOOTING':
    case 'MODEL_LOADING':
    case 'SELF_TEST':
    default:
      return { status: 'blocked', reason: `Manual blocked: runtime is ${state}` };
  }
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}
