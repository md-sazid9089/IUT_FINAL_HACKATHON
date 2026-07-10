import { describe, expect, it } from 'vitest';
import { approachUnitVector, keyButtonCenter } from './coordinates';

describe('approachUnitVector', () => {
  it('maps each axis to the correct unit vector', () => {
    expect(approachUnitVector('-z')).toEqual([0, 0, -1]);
    expect(approachUnitVector('z')).toEqual([0, 0, 1]);
    expect(approachUnitVector('x')).toEqual([1, 0, 0]);
    expect(approachUnitVector('-y')).toEqual([0, -1, 0]);
  });
});

describe('keyButtonCenter', () => {
  const contact = { x: 0.5, y: 0.05, z: 0.05 };

  it('places the button body below the contact point for a -z approach', () => {
    const center = keyButtonCenter(contact, '-z', 0.02);
    // Top face stays on the contact point; centre drops by half the height.
    expect(center[0]).toBeCloseTo(0.5, 10);
    expect(center[1]).toBeCloseTo(0.05, 10);
    expect(center[2]).toBeCloseTo(0.04, 10);
  });

  it('keeps the top face at the contact z (top = center_z + height/2)', () => {
    const height = 0.02;
    const center = keyButtonCenter(contact, '-z', height);
    expect(center[2] + height / 2).toBeCloseTo(contact.z, 10);
  });

  it('offsets along +z when the approach axis is z', () => {
    const center = keyButtonCenter(contact, 'z', 0.02);
    expect(center[2]).toBeCloseTo(0.06, 10);
  });
});
