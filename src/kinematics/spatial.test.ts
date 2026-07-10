import { describe, expect, it } from 'vitest';
import {
  axisAngleTransform,
  originTransform,
  rpyToQuat,
  transformDirection,
  translationOf,
} from './spatial';

describe('rpyToQuat', () => {
  it('returns identity for zero rotation', () => {
    expect(rpyToQuat(0, 0, 0)).toEqual([0, 0, 0, 1]);
  });

  it('produces a +90° yaw about Z', () => {
    const q = rpyToQuat(0, 0, Math.PI / 2);
    expect(q[0]).toBeCloseTo(0, 12);
    expect(q[1]).toBeCloseTo(0, 12);
    expect(q[2]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 12);
  });
});

describe('originTransform', () => {
  it('encodes a pure translation', () => {
    const t = originTransform([0.1, 0.2, 0.3], [0, 0, 0]);
    expect(translationOf(t)).toEqual([0.1, 0.2, 0.3]);
  });

  it('uses Float64Array storage', () => {
    const t = originTransform([0, 0, 0], [0, 0, 0]);
    expect(t).toBeInstanceOf(Float64Array);
  });
});

describe('axisAngleTransform + transformDirection', () => {
  it('rotates +X to +Y for a +90° turn about Z', () => {
    const t = axisAngleTransform([0, 0, 1], Math.PI / 2);
    const dir = transformDirection(t, [1, 0, 0]);
    expect(dir[0]).toBeCloseTo(0, 12);
    expect(dir[1]).toBeCloseTo(1, 12);
    expect(dir[2]).toBeCloseTo(0, 12);
  });

  it('normalizes a non-unit axis', () => {
    const t = axisAngleTransform([0, 0, 2], Math.PI / 2);
    const dir = transformDirection(t, [1, 0, 0]);
    expect(dir[1]).toBeCloseTo(1, 12);
  });
});
