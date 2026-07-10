import { describe, expect, it } from 'vitest';
import { mapVoiceCommand } from './voiceCommandMapper';
import { parseOffline } from './voiceAIParser';
import { parseVoiceCommand, parseVoiceCommandText } from './voiceCommandSchema';

const CTX = {
  jointValues: { joint_1: 0.1, joint_2: -0.2, joint_3: 0.3, joint_4: 0, joint_5: 0, joint_6: 0 },
  approachAxis: [0, 0, -1] as const,
};

describe('voice — schema validation', () => {
  it('rejects unknown types', () => {
    expect(parseVoiceCommand({ type: 'wat' }).ok).toBe(false);
  });
  it('accepts a well-formed cartesian move', () => {
    const r = parseVoiceCommand({ type: 'cartesian_move', axis: 'z', direction: 'negative', value: 0.05, unit: 'meter' });
    expect(r.ok).toBe(true);
    expect(r.command?.type).toBe('cartesian_move');
  });
  it('rejects invalid PINs', () => {
    expect(parseVoiceCommand({ type: 'pin_execute', pin: '999999' }).ok).toBe(false);
    expect(parseVoiceCommand({ type: 'pin_execute', pin: '12345' }).ok).toBe(false);
  });
  it('accepts a well-formed PIN', () => {
    expect(parseVoiceCommand({ type: 'pin_execute', pin: '123456' }).ok).toBe(true);
  });
  it('parses fenced-JSON model output', () => {
    const r = parseVoiceCommandText('```json\n{"type":"home"}\n```');
    expect(r.ok).toBe(true);
    expect(r.command?.type).toBe('home');
  });
  it('rejects malformed JSON', () => {
    expect(parseVoiceCommandText('not json').ok).toBe(false);
  });
});

describe('voice — offline rule parser', () => {
  it('understands stop / emergency stop', () => {
    expect(parseOffline('stop').command?.type).toBe('stop');
    expect(parseOffline('emergency stop please').command?.type).toBe('stop');
  });
  it('understands home / reset', () => {
    expect(parseOffline('go home').command?.type).toBe('home');
    expect(parseOffline('reset the robot').command?.type).toBe('home');
  });
  it('extracts axis + distance + unit', () => {
    const cmd = parseOffline('move down 5 centimeters').command;
    expect(cmd).toMatchObject({ type: 'cartesian_move', axis: 'z', direction: 'negative', value: 5, unit: 'centimeter' });
  });
  it('handles axes without a distance', () => {
    const cmd = parseOffline('move right').command;
    expect(cmd).toMatchObject({ type: 'cartesian_move', axis: 'x', direction: 'positive' });
    expect((cmd as { value?: number }).value).toBeUndefined();
  });
  it('understands PIN entry', () => {
    expect(parseOffline('enter pin 123456').command).toMatchObject({ type: 'pin_execute', pin: '123456' });
  });
  it('understands joint rotations', () => {
    expect(parseOffline('rotate joint 2 by 45 degrees').command).toMatchObject({
      type: 'joint_move',
      joint: 'joint_2',
      angle: 45,
      unit: 'degree',
    });
    expect(parseOffline('rotate the shoulder 30 degrees').command).toMatchObject({
      type: 'joint_move',
      joint: 'joint_2',
    });
  });
  it('asks for clarification on vague utterances', () => {
    expect(parseOffline('move slightly').command?.type).toBe('clarification_required');
  });
  it('reports failure for genuinely unknown phrases', () => {
    expect(parseOffline('hello world').ok).toBe(false);
  });
});

describe('voice — command mapper (never bypasses the runtime)', () => {
  it('maps a cartesian_move to a cartesian_jog with the mapped Δ', () => {
    const m = mapVoiceCommand(
      { type: 'cartesian_move', axis: 'z', direction: 'negative', value: 5, unit: 'centimeter' },
      CTX,
    );
    expect(m.kind).toBe('runtime');
    if (m.kind !== 'runtime') return;
    expect(m.command).toMatchObject({ type: 'cartesian_jog', source: 'voice' });
    expect((m.command as { delta: number[] }).delta).toEqual([0, 0, -0.05]);
  });
  it('caps unreasonably large distances', () => {
    const m = mapVoiceCommand({ type: 'cartesian_move', axis: 'x', direction: 'positive', value: 10, unit: 'meter' }, CTX);
    expect(m.kind).toBe('runtime');
    if (m.kind !== 'runtime') return;
    expect((m.command as { delta: number[] }).delta[0]).toBeLessThanOrEqual(0.5);
  });
  it('maps joint_move to move_joints as a RELATIVE rotation from current joints', () => {
    const m = mapVoiceCommand({ type: 'joint_move', joint: 'joint_2', angle: 45, unit: 'degree' }, CTX);
    expect(m.kind).toBe('runtime');
    if (m.kind !== 'runtime') return;
    const j = (m.command as { joints: Record<string, number> }).joints;
    // current joint_2 = -0.2; +45° ≈ +0.7854; expected ≈ 0.5854
    expect(j.joint_2).toBeCloseTo(-0.2 + Math.PI / 4, 9);
  });
  it('rejects out-of-range joint rotations', () => {
    const m = mapVoiceCommand({ type: 'joint_move', joint: 'joint_1', angle: 400, unit: 'degree' }, CTX);
    expect(m.kind).toBe('rejected');
  });
  it('maps stop / home to runtime verbs from source=voice', () => {
    const stop = mapVoiceCommand({ type: 'stop' }, CTX);
    const home = mapVoiceCommand({ type: 'home' }, CTX);
    expect(stop.kind).toBe('runtime');
    expect(home.kind).toBe('runtime');
    if (stop.kind === 'runtime') expect(stop.command).toEqual({ type: 'stop', source: 'voice' });
    if (home.kind === 'runtime') expect(home.command).toEqual({ type: 'home', source: 'voice' });
  });
  it('routes pin_execute through the PIN panel (never auto-submits)', () => {
    const m = mapVoiceCommand({ type: 'pin_execute', pin: '123456' }, CTX);
    expect(m.kind).toBe('pin');
    if (m.kind === 'pin') expect(m.pin).toBe('123456');
  });
  it('turns clarification_required into a clarify submission (no runtime command)', () => {
    const m = mapVoiceCommand({ type: 'clarification_required', message: 'Which axis?' }, CTX);
    expect(m.kind).toBe('clarify');
  });
});
