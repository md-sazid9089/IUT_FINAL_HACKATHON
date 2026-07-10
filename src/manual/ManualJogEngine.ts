import type { CommandSource } from '../runtime/commands';
import { isManualSource } from '../runtime/commands';
import type { RuntimeState } from '../runtime/runtimeState';
import { CartesianMotionController, type CartesianAxis } from './cartesianMotionController';
import {
  buildJogDelta,
  DEFAULT_APPROACH_AXIS,
  DEFAULT_DEAD_ZONE,
  DEFAULT_SPEED_MODE,
  jogCommand,
  keysToDirection,
  magnitude,
  manualJogGate,
  SPEED_INCREMENTS,
  type SpeedMode,
  type Vec3,
} from './jogModel';

/**
 * Snapshot of the runtime the engine needs to gate emission. Provided by the
 * host (React hook reads it from the runtime store); tests provide a stub.
 */
export interface RuntimeStatus {
  readonly state: RuntimeState;
  readonly activeSource: CommandSource | null;
}

export interface ManualStatus {
  readonly speedMode: SpeedMode;
  /** Which manual source is currently emitting jogs, if any. */
  readonly activeSource: 'keyboard' | 'joystick' | null;
  /** Last emitted Cartesian delta (metres); zero when idle. */
  readonly movementVector: Vec3;
  readonly heldKeys: readonly string[];
  /** Combined joystick translation input [x, y, z] (pre-normalisation). */
  readonly joystickVector: Vec3;
  /** Orientation-stick rotation input ∈ [-1,1] (Phase 1: display only). */
  readonly rotationInput: number;
  readonly lastRejection: string | null;
}

export interface ManualJogEngineOptions {
  /** Sink into the Gate 4 runtime (getRuntime().submit). */
  readonly submit: (command: unknown) => void;
  /** Current runtime state + active command owner. */
  readonly getRuntimeStatus: () => RuntimeStatus;
  /** Current TCP approach axis so jogs preserve tool orientation. */
  readonly approachAxis?: () => Vec3;
  readonly deadZone?: number;
  readonly onStatus?: (status: ManualStatus) => void;
}

/**
 * ManualJogEngine turns discrete input state (held keys, joystick vector, Z
 * buttons) into a fixed-rate stream of validated Cartesian jog commands routed
 * through the Gate 4 runtime. It owns NO timers and NO DOM — the host drives
 * `tick()` at a fixed rate, and tests call it directly with a mock clock. This
 * keeps every safety behaviour (release, blur, hidden tab, unmount) verifiable.
 */
export class ManualJogEngine {
  private readonly submit: (command: unknown) => void;
  private readonly getRuntimeStatus: () => RuntimeStatus;
  private readonly approachAxis: () => Vec3;
  private readonly deadZone: number;
  private readonly onStatus?: (status: ManualStatus) => void;

  private readonly keys = new Set<string>();
  /** 3D Cartesian teleoperation input (axis joysticks, sticks, Z buttons). */
  private readonly cartesian: CartesianMotionController;
  private speedMode: SpeedMode = DEFAULT_SPEED_MODE;

  private activeSource: 'keyboard' | 'joystick' | null = null;
  private movement: Vec3 = [0, 0, 0];
  private lastRejection: string | null = null;
  private wasEmitting = false;

  constructor(opts: ManualJogEngineOptions) {
    this.submit = opts.submit;
    this.getRuntimeStatus = opts.getRuntimeStatus;
    this.approachAxis = opts.approachAxis ?? (() => DEFAULT_APPROACH_AXIS);
    this.deadZone = opts.deadZone ?? DEFAULT_DEAD_ZONE;
    this.cartesian = new CartesianMotionController(this.deadZone);
    this.onStatus = opts.onStatus;
  }

  // ---- input mutation -----------------------------------------------------

  setSpeed(mode: SpeedMode): void {
    if (this.speedMode !== mode) {
      this.speedMode = mode;
      this.notify();
    }
  }

  getSpeed(): SpeedMode {
    return this.speedMode;
  }

  keyDown(key: string): void {
    const k = key.toLowerCase();
    if (!(k in KEY_SET)) return;
    if (!this.keys.has(k)) {
      this.keys.add(k);
      this.notify();
    }
  }

  keyUp(key: string): void {
    const k = key.toLowerCase();
    if (this.keys.delete(k)) this.notify();
  }

  /** Single-axis virtual joystick (X, Y or Z pad): value ∈ [-1, 1]. */
  setAxis(axis: CartesianAxis, value: number): void {
    this.cartesian.setAxis(axis, value);
    this.notify();
  }

  clearAxis(axis: CartesianAxis): void {
    this.cartesian.clearAxis(axis);
    this.notify();
  }

  /** Position stick (stick 1): x → TCP ±X, y → TCP ±Y. */
  setJoystick(x: number, y: number): void {
    this.cartesian.setPositionStick(x, y);
    this.notify();
  }

  clearJoystick(): void {
    this.cartesian.clearPositionStick();
    this.notify();
  }

  /** Orientation stick (stick 2): y → TCP ±Z, x → tool rotation. */
  setOrientationStick(x: number, y: number): void {
    this.cartesian.setOrientationStick(x, y);
    this.notify();
  }

  clearOrientationStick(): void {
    this.cartesian.clearOrientationStick();
    this.notify();
  }

  /** Press-and-hold Z: dir = +1 (+Z) or −1 (−Z). */
  pressZ(dir: 1 | -1): void {
    this.cartesian.pressZ(dir);
    this.notify();
  }

  releaseZ(): void {
    this.cartesian.releaseZ();
    this.notify();
  }

  /** Clear ALL held input (blur, hidden tab, unmount). Halts motion promptly. */
  clearAll(): void {
    const had = this.keys.size > 0 || this.cartesian.hasInput();
    this.keys.clear();
    this.cartesian.clearAll();
    if (had || this.wasEmitting) {
      this.finishEmitting();
    }
    this.notify();
  }

  // ---- one-shot verbs -----------------------------------------------------

  home(): void {
    this.submit({ type: 'home', source: 'keyboard' });
  }

  stopMotion(): void {
    this.clearInputOnly();
    this.finishEmittingForce();
    this.submit({ type: 'stop', source: 'system' });
    this.notify();
  }

  estop(): void {
    this.clearInputOnly();
    this.finishEmittingForce();
    this.submit({ type: 'estop', source: 'system' });
    this.notify();
  }

  // ---- fixed-rate emission ------------------------------------------------

  /**
   * One controlled step. Emits at most one jog command for the dominant input
   * (keyboard takes precedence over joystick). Called at a fixed rate by the
   * host — NOT driven by OS key-repeat events.
   */
  tick(): void {
    const status = this.getRuntimeStatus();

    const kbDir = keysToDirection(this.keys);
    const kbActive = magnitude(kbDir) > 0;
    const jsActive = this.cartesian.hasInput();

    let source: 'keyboard' | 'joystick' | null = null;
    let rawDir: Vec3 = [0, 0, 0];
    if (kbActive) {
      source = 'keyboard';
      rawDir = kbDir;
    } else if (jsActive) {
      source = 'joystick';
      rawDir = this.cartesian.translation();
    }

    if (source === null) {
      this.finishEmitting();
      return;
    }

    const gate = manualJogGate(status.state, status.activeSource);
    if (gate.status === 'blocked') {
      if (this.lastRejection !== gate.reason) {
        this.lastRejection = gate.reason ?? null;
        this.activeSource = null;
        this.movement = [0, 0, 0];
        this.notify();
      }
      return;
    }
    if (gate.status === 'busy') {
      // Our own manual jog is still planning/executing. Hold this tick and
      // emit the next step once it completes — no rejection, keep the input.
      return;
    }

    const delta = buildJogDelta(rawDir, SPEED_INCREMENTS[this.speedMode], this.deadZone);
    if (magnitude(delta) === 0) {
      // Opposite directions cancelled — treat as a stop, never queue.
      this.finishEmitting();
      return;
    }

    this.submit(jogCommand(source, delta, this.approachAxis()));
    this.wasEmitting = true;
    this.activeSource = source;
    this.movement = delta;
    if (this.lastRejection !== null) this.lastRejection = null;
    this.notify();
  }

  getStatus(): ManualStatus {
    return {
      speedMode: this.speedMode,
      activeSource: this.activeSource,
      movementVector: [...this.movement],
      heldKeys: [...this.keys],
      joystickVector: this.cartesian.translation(),
      rotationInput: this.cartesian.input().yaw,
      lastRejection: this.lastRejection,
    };
  }

  // ---- internal -----------------------------------------------------------

  private clearInputOnly(): void {
    this.keys.clear();
    this.cartesian.clearAll();
  }

  /** Stop emitting; issue a guarded system Stop only if we owned the motion. */
  private finishEmitting(): void {
    if (!this.wasEmitting && this.activeSource === null && this.movement.every((v) => v === 0)) return;
    this.wasEmitting = false;
    this.activeSource = null;
    this.movement = [0, 0, 0];
    const { state, activeSource } = this.getRuntimeStatus();
    // Only halt an actively EXECUTING manual trajectory. A jog still PLANNING is
    // allowed to complete one step, so a quick flick produces visible motion.
    if (state === 'EXECUTING' && (activeSource === null || isManualSource(activeSource))) {
      this.submit({ type: 'stop', source: 'system' });
    }
    this.notify();
  }

  private finishEmittingForce(): void {
    this.wasEmitting = false;
    this.activeSource = null;
    this.movement = [0, 0, 0];
  }

  private notify(): void {
    this.onStatus?.(this.getStatus());
  }
}

/** Keys the engine tracks as held movement keys (lowercase). */
const KEY_SET: Readonly<Record<string, true>> = {
  w: true,
  a: true,
  s: true,
  d: true,
  r: true,
  f: true,
};
