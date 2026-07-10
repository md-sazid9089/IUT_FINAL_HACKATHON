import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRuntime } from '../runtime/runtimeInstance';
import { useRuntimeStore } from '../state/runtimeStore';
import { useRobotStore } from '../state/robotStore';
import { ManualJogEngine, type ManualStatus } from './ManualJogEngine';
import {
  DEFAULT_APPROACH_AXIS,
  DEFAULT_SPEED_MODE,
  isMoveKey,
  JOG_RATE_HZ,
  type SpeedMode,
  type Vec3,
} from './jogModel';

/** True when focus is in a text-entry element (shortcuts must be ignored). */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

export interface ManualJogControls {
  readonly status: ManualStatus;
  readonly setBaseSpeed: (mode: SpeedMode) => void;
  readonly setJoystick: (x: number, y: number) => void;
  readonly clearJoystick: () => void;
  readonly pressZ: (dir: 1 | -1) => void;
  readonly releaseZ: () => void;
  readonly home: () => void;
  readonly stopMotion: () => void;
  readonly estop: () => void;
}

/**
 * Wires the ManualJogEngine to the browser: a fixed-rate emission loop, global
 * keyboard state, and every input-loss safety event (blur, hidden tab, unmount).
 * The engine remains DOM-free; this hook is the single place DOM meets it.
 */
export function useManualJog(): ManualJogControls {
  const [status, setStatus] = useState<ManualStatus>({
    speedMode: DEFAULT_SPEED_MODE,
    activeSource: null,
    movementVector: [0, 0, 0],
    heldKeys: [],
    joystickVector: [0, 0, 0],
    lastRejection: null,
  });

  // Speed = base (buttons) overridden while Shift (fast) / Alt (precision) held.
  const baseSpeed = useRef<SpeedMode>(DEFAULT_SPEED_MODE);
  const shiftHeld = useRef(false);
  const altHeld = useRef(false);

  const engine = useMemo(
    () =>
      new ManualJogEngine({
        submit: (command) => getRuntime()?.submit(command),
        getRuntimeStatus: () => {
          const snap = useRuntimeStore.getState().snapshot;
          return {
            state: snap?.state ?? 'BOOTING',
            activeSource: snap?.activeCommand?.source ?? null,
          };
        },
        approachAxis: () => {
          const axis = useRobotStore.getState().toolAxis;
          return (axis ? [axis[0], axis[1], axis[2]] : DEFAULT_APPROACH_AXIS) as Vec3;
        },
        onStatus: setStatus,
      }),
    [],
  );

  const applyEffectiveSpeed = useCallback(() => {
    const mode: SpeedMode = shiftHeld.current ? 'fast' : altHeld.current ? 'precision' : baseSpeed.current;
    engine.setSpeed(mode);
  }, [engine]);

  const setBaseSpeed = useCallback(
    (mode: SpeedMode) => {
      baseSpeed.current = mode;
      applyEffectiveSpeed();
    },
    [applyEffectiveSpeed],
  );

  // Fixed-rate emission loop — independent of OS key repeat.
  useEffect(() => {
    const id = window.setInterval(() => engine.tick(), 1000 / JOG_RATE_HZ);
    return () => window.clearInterval(id);
  }, [engine]);

  // Global keyboard controller.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      // Modifiers (speed) — track even on repeat, cheaply idempotent.
      if (e.key === 'Shift') {
        shiftHeld.current = true;
        applyEffectiveSpeed();
        return;
      }
      if (e.key === 'Alt') {
        altHeld.current = true;
        applyEffectiveSpeed();
        return;
      }

      // One-shot verbs: ignore auto-repeat.
      if (e.key === 'Escape') {
        e.preventDefault();
        engine.estop();
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) engine.stopMotion();
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        if (!e.repeat) engine.home();
        return;
      }

      // Movement keys: set state; the loop (not repeat) drives emission.
      if (isMoveKey(e.key)) {
        e.preventDefault();
        engine.keyDown(e.key);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') {
        shiftHeld.current = false;
        applyEffectiveSpeed();
        return;
      }
      if (e.key === 'Alt') {
        altHeld.current = false;
        applyEffectiveSpeed();
        return;
      }
      // keyup always clears the movement key, even if focus moved into a field.
      if (isMoveKey(e.key)) engine.keyUp(e.key);
    }

    function clearEverything() {
      shiftHeld.current = false;
      altHeld.current = false;
      applyEffectiveSpeed();
      engine.clearAll();
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') clearEverything();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearEverything);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearEverything);
      document.removeEventListener('visibilitychange', onVisibility);
      // Unmount: clear timers (above) and all key/joystick state.
      engine.clearAll();
    };
  }, [engine, applyEffectiveSpeed]);

  return {
    status,
    setBaseSpeed,
    setJoystick: useCallback((x: number, y: number) => engine.setJoystick(x, y), [engine]),
    clearJoystick: useCallback(() => engine.clearJoystick(), [engine]),
    pressZ: useCallback((dir: 1 | -1) => engine.pressZ(dir), [engine]),
    releaseZ: useCallback(() => engine.releaseZ(), [engine]),
    home: useCallback(() => engine.home(), [engine]),
    stopMotion: useCallback(() => engine.stopMotion(), [engine]),
    estop: useCallback(() => engine.estop(), [engine]),
  };
}
