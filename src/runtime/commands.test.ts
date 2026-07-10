import { describe, expect, it } from 'vitest';
import { parseCommand, priorityOf, SOURCE_PRIORITY } from './commands';

describe('parseCommand', () => {
  it('accepts a well-formed move_joints command and fills id/issuedAt', () => {
    const r = parseCommand({ type: 'move_joints', source: 'dashboard', joints: { joint_1: 0.5 } }, 1000);
    expect(r.ok).toBe(true);
    expect(r.command?.type).toBe('move_joints');
    expect(r.command?.id).toBeTruthy();
    expect(r.command?.issuedAt).toBe(1000);
  });

  it('rejects an unknown command type', () => {
    const r = parseCommand({ type: 'teleport', source: 'dashboard' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid command/i);
  });

  it('rejects a malformed command (missing source)', () => {
    const r = parseCommand({ type: 'stop' });
    expect(r.ok).toBe(false);
  });

  it('rejects non-finite joint targets', () => {
    const r = parseCommand({
      type: 'move_joints',
      source: 'dashboard',
      joints: { joint_1: Number.POSITIVE_INFINITY },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown source', () => {
    const r = parseCommand({ type: 'stop', source: 'hacker' });
    expect(r.ok).toBe(false);
  });
});

describe('priority', () => {
  it('orders system highest and joystick lowest', () => {
    expect(priorityOf('system')).toBe(SOURCE_PRIORITY.system);
    expect(priorityOf('system')).toBeGreaterThan(priorityOf('autonomous'));
    expect(priorityOf('autonomous')).toBeGreaterThan(priorityOf('dashboard'));
    expect(priorityOf('dashboard')).toBeGreaterThan(priorityOf('joystick'));
  });
});
