import type { CommandSource } from '../runtime/commands';
import { isManualSource } from '../runtime/commands';
import type { RuntimeState } from '../runtime/runtimeState';
import {
  buildJogDelta,
  DEFAULT_APPROACH_AXIS,
  DEFAULT_DEAD_ZONE,
  DEFAULT_SPEED_MODE,
  jogCommand,
  keysToDirection,
  magnitude,
  manualJogGate,
  normalizeDirection,
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
  /** Raw joystick+Z input vector (pre-normalisation). */
  readonly joystickVector: Vec3;
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
  private joystick: [number, number] = [0, 0];
  private zButton = 0;
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

  setJoystick(x: number, y: number): void {
    this.joystick = [x, y];
    this.notify();
  }

  clearJoystick(): void {
    if (this.joystick[0] !== 0 || this.joystick[1] !== 0) {
      this.joystick = [0, 0];
      this.notify();
    }
  }

  /** Press-and-hold Z: dir = +1 (+Z) or −1 (−Z). */
  pressZ(dir: 1 | -1): void {
    if (this.zButton !== dir) {
      this.zButton = dir;
      this.notify();
    }
  }

  releaseZ(): void {
    if (this.zButton !== 0) {
      this.zButton = 0;
      this.notify();
    }
  }

  /** Clear ALL held input (blur, hidden tab, unmount). Halts motion promptly. */
  clearAll(): void {
    const had = this.keys.size > 0 || this.joystick[0] !== 0 || this.joystick[1] !== 0 || this.zButton !== 0;
    this.keys.clear();
    this.joystick = [0, 0];
    this.zButton = 0;
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
    const jsRaw: Vec3 = [this.joystick[0], this.joystick[1], this.zButton];
    const jsActive = magnitude(normalizeDirection(jsRaw, this.deadZone)) > 0;

    let source: 'keyboard' | 'joystick' | null = null;
    let rawDir: Vec3 = [0, 0, 0];
    if (kbActive) {
      source = 'keyboard';
      rawDir = kbDir;
    } else if (jsActive) {
      source = 'joystick';
      rawDir = jsRaw;
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
      joystickVector: [this.joystick[0], this.joystick[1], this.zButton],
      lastRejection: this.lastRejection,
    };
  }

  // ---- internal -----------------------------------------------------------

  private clearInputOnly(): void {
    this.keys.clear();
    this.joystick = [0, 0];
    this.zButton = 0;
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
