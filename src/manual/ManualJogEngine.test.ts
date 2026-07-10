import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualJogEngine, type RuntimeStatus } from './ManualJogEngine';
import { SPEED_INCREMENTS } from './jogModel';

interface Harness {
  engine: ManualJogEngine;
  submit: ReturnType<typeof vi.fn>;
  setStatus: (s: RuntimeStatus) => void;
  jogs: () => Array<{ type: string; source: string; delta: [number, number, number] }>;
  lastDelta: () => [number, number, number] | null;
}

function harness(initial: RuntimeStatus = { state: 'READY', activeSource: null }): Harness {
  const submit = vi.fn();
  let status = initial;
  const engine = new ManualJogEngine({
    submit,
    getRuntimeStatus: () => status,
  });
  const jogs = () => submit.mock.calls.map((c) => c[0]).filter((c) => c.type === 'cartesian_jog');
  return {
    engine,
    submit,
    setStatus: (s) => (status = s),
    jogs,
    lastDelta: () => {
      const j = jogs();
      return j.length ? j[j.length - 1].delta : null;
    },
  };
}

const N = SPEED_INCREMENTS.normal;

describe('ManualJogEngine — keyboard emission', () => {
  let h: Harness;
  beforeEach(() => (h = harness()));

  it('emits +X for D, -X for A', () => {
    h.engine.keyDown('d');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([N, 0, 0]);
    h.engine.keyUp('d');
    h.engine.keyDown('a');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([-N, 0, 0]);
  });

  it('emits +Y for W, -Y for S', () => {
    h.engine.keyDown('w');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, N, 0]);
    h.engine.keyUp('w');
    h.engine.keyDown('s');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, -N, 0]);
  });

  it('emits +Z for R, -Z for F', () => {
    h.engine.keyDown('r');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, N]);
    h.engine.keyUp('r');
    h.engine.keyDown('f');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, -N]);
  });

  it('does not depend on OS key repeat — one keyDown emits every tick', () => {
    h.engine.keyDown('d');
    h.engine.tick();
    h.engine.tick();
    h.engine.tick();
    expect(h.jogs()).toHaveLength(3);
  });

  it('keyup stops movement', () => {
    h.engine.keyDown('d');
    h.engine.tick();
    h.engine.keyUp('d');
    const before = h.jogs().length;
    h.engine.tick();
    expect(h.jogs()).toHaveLength(before); // no further jogs
  });

  it('opposite keys cancel to zero and never queue', () => {
    h.engine.keyDown('w');
    h.engine.keyDown('s');
    h.engine.tick();
    expect(h.jogs()).toHaveLength(0);
  });
});

describe('ManualJogEngine — speed modes', () => {
  it('applies precision/normal/fast', () => {
    const h = harness();
    h.engine.keyDown('d');
    h.engine.setSpeed('precision');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([SPEED_INCREMENTS.precision, 0, 0]);
    h.engine.setSpeed('fast');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([SPEED_INCREMENTS.fast, 0, 0]);
    h.engine.setSpeed('normal');
    h.engine.tick();
    expect(h.lastDelta()).toEqual([SPEED_INCREMENTS.normal, 0, 0]);
  });
});

describe('ManualJogEngine — joystick emission', () => {
  it('suppresses input inside the dead zone', () => {
    const h = harness();
    h.engine.setJoystick(0.05, 0.05);
    h.engine.tick();
    expect(h.jogs()).toHaveLength(0);
  });

  it('emits +X and -X', () => {
    const h = harness();
    h.engine.setJoystick(1, 0);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([N, 0, 0]);
    h.engine.setJoystick(-1, 0);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([-N, 0, 0]);
  });

  it('emits +Y and -Y', () => {
    const h = harness();
    h.engine.setJoystick(0, 1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, N, 0]);
    h.engine.setJoystick(0, -1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, -N, 0]);
  });

  it('normalizes a diagonal to unit magnitude', () => {
    const h = harness();
    h.engine.setJoystick(1, 1);
    h.engine.tick();
    const d = h.lastDelta()!;
    expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(N, 12);
  });

  it('Z buttons emit +Z / -Z', () => {
    const h = harness();
    h.engine.pressZ(1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, N]);
    h.engine.releaseZ();
    h.engine.pressZ(-1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, -N]);
  });

  it('orientation stick up/down emits +Z / -Z', () => {
    const h = harness();
    h.engine.setOrientationStick(0, 1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, N]);
    h.engine.setOrientationStick(0, -1);
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, 0, -N]);
    h.engine.clearOrientationStick();
    const before = h.jogs().length;
    h.engine.tick();
    expect(h.jogs()).toHaveLength(before); // release stops emission
  });

  it('orientation stick rotation alone emits no translation (phase 1)', () => {
    const h = harness();
    h.engine.setOrientationStick(1, 0);
    h.engine.tick();
    expect(h.jogs()).toHaveLength(0);
    expect(h.engine.getStatus().rotationInput).toBe(1);
  });

  it('keyboard takes precedence over joystick', () => {
    const h = harness();
    h.engine.setJoystick(1, 0); // +X
    h.engine.keyDown('w'); // +Y
    h.engine.tick();
    expect(h.lastDelta()).toEqual([0, N, 0]);
  });
});

describe('ManualJogEngine — input-loss safety', () => {
  it('pointer release stops emission', () => {
    const h = harness();
    h.engine.setJoystick(1, 0);
    h.engine.tick();
    h.engine.clearJoystick(); // pointer up
    const before = h.jogs().length;
    h.engine.tick();
    expect(h.jogs()).toHaveLength(before);
  });

  it('pointer-capture loss (clearJoystick) stops emission', () => {
    const h = harness();
    h.engine.setJoystick(0, 1);
    h.engine.tick();
    h.engine.clearJoystick();
    const before = h.jogs().length;
    h.engine.tick();
    expect(h.jogs()).toHaveLength(before);
  });

  it('window blur (clearAll) clears keys and joystick', () => {
    const h = harness();
    h.engine.keyDown('d');
    h.engine.setJoystick(1, 0);
    h.engine.clearAll();
    h.engine.tick();
    expect(h.jogs()).toHaveLength(0);
    expect(h.engine.getStatus().heldKeys).toHaveLength(0);
  });

  it('hidden tab (clearAll) stops movement', () => {
    const h = harness();
    h.engine.keyDown('w');
    h.engine.tick();
    h.engine.clearAll();
    const before = h.jogs().length;
    h.engine.tick();
    expect(h.jogs()).toHaveLength(before);
  });

  it('unmount (clearAll) clears everything', () => {
    const h = harness();
    h.engine.keyDown('r');
    h.engine.setJoystick(0, 1);
    h.engine.pressZ(1);
    h.engine.clearAll();
    const s = h.engine.getStatus();
    expect(s.heldKeys).toHaveLength(0);
    expect(s.joystickVector).toEqual([0, 0, 0]);
  });

  it('issues a guarded system Stop on release while executing a manual jog', () => {
    const h = harness({ state: 'READY', activeSource: null });
    h.engine.keyDown('d');
    h.engine.tick(); // READY → emits jog, now owns motion
    h.setStatus({ state: 'EXECUTING', activeSource: 'keyboard' });
    h.engine.tick(); // busy — waits
    h.engine.keyUp('d');
    h.engine.tick(); // release → guarded system stop
    const stops = h.submit.mock.calls.map((c) => c[0]).filter((c) => c.type === 'stop');
    expect(stops.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT stop autonomous motion on release', () => {
    const h = harness({ state: 'EXECUTING', activeSource: 'autonomous' });
    // manual gate blocks emission while autonomous owns motion
    h.engine.keyDown('d');
    h.engine.tick();
    h.engine.keyUp('d');
    h.engine.tick();
    const stops = h.submit.mock.calls.map((c) => c[0]).filter((c) => c.type === 'stop');
    expect(stops).toHaveLength(0);
  });
});

describe('ManualJogEngine — runtime gating', () => {
  it('does not emit while autonomous owns motion', () => {
    const h = harness({ state: 'EXECUTING', activeSource: 'autonomous' });
    h.engine.keyDown('d');
    h.engine.tick();
    expect(h.jogs()).toHaveLength(0);
    expect(h.engine.getStatus().lastRejection).toMatch(/autonomous/);
  });

  it('emits during our own PLANNING (queued for chaining) but never when E_STOPPED or autonomous plans', () => {
    // Our own manual planning → emission allowed (runtime dedupe-queues it).
    const h = harness({ state: 'PLANNING', activeSource: 'joystick' });
    h.engine.keyDown('d');
    h.engine.tick();
    expect(h.jogs()).toHaveLength(1);
    // Autonomous-owned planning → blocked.
    h.setStatus({ state: 'PLANNING', activeSource: 'autonomous' });
    h.engine.tick();
    expect(h.jogs()).toHaveLength(1);
    // E-stopped → blocked.
    h.setStatus({ state: 'E_STOPPED', activeSource: null });
    h.engine.tick();
    expect(h.jogs()).toHaveLength(1);
  });
});

describe('ManualJogEngine — one-shot verbs', () => {
  it('home submits a home command from keyboard', () => {
    const h = harness();
    h.engine.home();
    expect(h.submit).toHaveBeenCalledWith({ type: 'home', source: 'keyboard' });
  });

  it('stopMotion submits a system stop and clears input', () => {
    const h = harness();
    h.engine.keyDown('d');
    h.engine.stopMotion();
    expect(h.submit).toHaveBeenCalledWith({ type: 'stop', source: 'system' });
    expect(h.engine.getStatus().heldKeys).toHaveLength(0);
  });

  it('estop submits a system estop and clears input', () => {
    const h = harness();
    h.engine.keyDown('d');
    h.engine.estop();
    expect(h.submit).toHaveBeenCalledWith({ type: 'estop', source: 'system' });
    expect(h.engine.getStatus().heldKeys).toHaveLength(0);
  });
});
