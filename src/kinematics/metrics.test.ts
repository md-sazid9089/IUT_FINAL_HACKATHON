import { describe, expect, it } from 'vitest';
import { orientationErrorRad, positionError, toolAxisDot } from './metrics';

describe('positionError', () => {
  it('is zero for identical points and Euclidean otherwise', () => {
    expect(positionError([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(positionError([0, 0, 0], [0, 3, 4])).toBeCloseTo(5, 12);
  });
});

describe('orientationErrorRad', () => {
  it('is zero for the same quaternion', () => {
    expect(orientationErrorRad([0, 0, 0, 1], [0, 0, 0, 1])).toBeCloseTo(0, 12);
  });

  it('treats q and -q as the same rotation', () => {
    expect(orientationErrorRad([0, 0, 0, 1], [0, 0, 0, -1])).toBeCloseTo(0, 12);
  });

  it('reports π for a 180° difference about Z', () => {
    expect(orientationErrorRad([0, 0, 0, 1], [0, 0, 1, 0])).toBeCloseTo(Math.PI, 10);
  });
});

describe('toolAxisDot', () => {
  it('is 1 for aligned axes and -1 for opposed', () => {
    expect(toolAxisDot([0, 0, 1], [0, 0, 1])).toBeCloseTo(1, 12);
    expect(toolAxisDot([0, 0, 1], [0, 0, -1])).toBeCloseTo(-1, 12);
  });
});
