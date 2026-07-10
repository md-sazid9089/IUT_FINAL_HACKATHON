import { describe, expect, it } from 'vitest';
import {
  buildJogDelta,
  DEFAULT_APPROACH_AXIS,
  DEFAULT_DEAD_ZONE,
  isMoveKey,
  jogCommand,
  keysToDirection,
  magnitude,
  manualJogGate,
  normalizeDirection,
  SPEED_INCREMENTS,
  toDegrees,
} from './jogModel';

const N = SPEED_INCREMENTS.normal;

describe('jogModel — speed modes', () => {
  it('defines precision/normal/fast increments', () => {
    expect(SPEED_INCREMENTS.precision).toBe(0.001);
    expect(SPEED_INCREMENTS.normal).toBe(0.005);
    expect(SPEED_INCREMENTS.fast).toBe(0.01);
  });

  it('scales the same direction by the selected mode', () => {
    const dir: [number, number, number] = [1, 0, 0];
    expect(buildJogDelta(dir, SPEED_INCREMENTS.precision)).toEqual([0.001, 0, 0]);
    expect(buildJogDelta(dir, SPEED_INCREMENTS.normal)).toEqual([0.005, 0, 0]);
    expect(buildJogDelta(dir, SPEED_INCREMENTS.fast)).toEqual([0.01, 0, 0]);
  });
});

describe('jogModel — dead zone', () => {
  it('suppresses input inside the dead zone', () => {
    expect(normalizeDirection([0.1, 0, 0], DEFAULT_DEAD_ZONE)).toEqual([0, 0, 0]);
    expect(buildJogDelta([0.1, 0.05, 0], N)).toEqual([0, 0, 0]);
  });

  it('passes input above the dead zone', () => {
    const d = buildJogDelta([0.5, 0, 0], N);
    expect(d[0]).toBeCloseTo(0.5 * N, 12);
  });
});

describe('jogModel — axis mapping', () => {
  it('+X', () => expect(buildJogDelta([1, 0, 0], N)).toEqual([N, 0, 0]));
  it('-X', () => expect(buildJogDelta([-1, 0, 0], N)).toEqual([-N, 0, 0]));
  it('+Y', () => expect(buildJogDelta([0, 1, 0], N)).toEqual([0, N, 0]));
  it('-Y', () => expect(buildJogDelta([0, -1, 0], N)).toEqual([0, -N, 0]));
  it('+Z', () => expect(buildJogDelta([0, 0, 1], N)).toEqual([0, 0, N]));
  it('-Z', () => expect(buildJogDelta([0, 0, -1], N)).toEqual([0, 0, -N]));
});

describe('jogModel — diagonal normalization', () => {
  it('clamps a corner deflection to unit length', () => {
    const d = buildJogDelta([1, 1, 0], N);
    expect(magnitude(d)).toBeCloseTo(N, 12);
    expect(d[0]).toBeCloseTo(d[1], 12);
  });
});

describe('jogModel — keyboard mapping', () => {
  it('maps W/S/A/D/R/F to axes', () => {
    expect(keysToDirection(['w'])).toEqual([0, 1, 0]);
    expect(keysToDirection(['s'])).toEqual([0, -1, 0]);
    expect(keysToDirection(['a'])).toEqual([-1, 0, 0]);
    expect(keysToDirection(['d'])).toEqual([1, 0, 0]);
    expect(keysToDirection(['r'])).toEqual([0, 0, 1]);
    expect(keysToDirection(['f'])).toEqual([0, 0, -1]);
  });

  it('is case-insensitive and ignores unmapped keys', () => {
    expect(keysToDirection(['D', 'x'])).toEqual([1, 0, 0]);
    expect(isMoveKey('W')).toBe(true);
    expect(isMoveKey('q')).toBe(false);
  });

  it('cancels opposite keys to zero (W+S, A+D, R+F)', () => {
    expect(keysToDirection(['w', 's'])).toEqual([0, 0, 0]);
    expect(keysToDirection(['a', 'd'])).toEqual([0, 0, 0]);
    expect(keysToDirection(['r', 'f'])).toEqual([0, 0, 0]);
    expect(buildJogDelta(keysToDirection(['w', 's']), N)).toEqual([0, 0, 0]);
  });
});

describe('jogModel — joystick/keyboard equivalence', () => {
  it('joystick full +X equals keyboard D at the same speed', () => {
    const joystick = buildJogDelta([1, 0, 0], N); // full deflection
    const keyboard = buildJogDelta(keysToDirection(['d']), N);
    expect(joystick).toEqual(keyboard);
  });

  it('produces identical commands for equivalent inputs', () => {
    const a = jogCommand('joystick', buildJogDelta([0, 1, 0], N));
    const b = jogCommand('keyboard', buildJogDelta(keysToDirection(['w']), N));
    expect(a.delta).toEqual(b.delta);
    expect(a.approachAxis).toEqual(DEFAULT_APPROACH_AXIS);
  });
});

describe('jogModel — manualJogGate', () => {
  it('allows a jog when READY', () => expect(manualJogGate('READY', null).status).toBe('allowed'));
  it('allows preemptive jogs while a manual jog is EXECUTING (continuous motion)', () => {
    expect(manualJogGate('EXECUTING', 'keyboard').status).toBe('allowed');
    expect(manualJogGate('EXECUTING', 'joystick').status).toBe('allowed');
    expect(manualJogGate('EXECUTING', null).status).toBe('allowed');
  });
  it('is busy (waits) while our own manual jog is PLANNING', () => {
    expect(manualJogGate('PLANNING', 'joystick').status).toBe('busy');
    expect(manualJogGate('PLANNING', null).status).toBe('busy');
  });
  it('blocks EXECUTING/PLANNING when autonomous owns motion', () => {
    const g = manualJogGate('EXECUTING', 'autonomous');
    expect(g.status).toBe('blocked');
    expect(g.reason).toMatch(/autonomous/);
    expect(manualJogGate('PLANNING', 'autonomous').status).toBe('blocked');
  });
  it('blocks unsafe states', () => {
    for (const s of ['BOOTING', 'MODEL_LOADING', 'SELF_TEST', 'E_STOPPED', 'FAULT', 'PAUSED'] as const) {
      expect(manualJogGate(s, null).status).toBe('blocked');
    }
  });
});

describe('jogModel — helpers', () => {
  it('converts radians to degrees', () => {
    expect(toDegrees(Math.PI)).toBeCloseTo(180, 9);
  });
});
