import { describe, expect, it } from 'vitest';
import { CartesianMotionController, PREFERRED_MANUAL_POSTURE } from './cartesianMotionController';
import { SPEED_INCREMENTS } from './jogModel';

const N = SPEED_INCREMENTS.normal;
const TCP: [number, number, number] = [0.3, 0.2, 0.25];

describe('CartesianMotionController — per-axis joysticks', () => {
  it('X axis right → TCP +X target relative to the current TCP', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 1);
    const step = c.buildStep(TCP, N);
    expect(step.idle).toBe(false);
    expect(step.delta).toEqual([N, 0, 0]);
    expect(step.target.position).toEqual({ x: 0.3 + N, y: 0.2, z: 0.25 });
    expect(step.target.source).toBe('joystick');
  });

  it('X left → −X, Y up → +Y, Y down → −Y, Z up → +Z, Z down → −Z', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', -1);
    expect(c.buildStep(TCP, N).delta).toEqual([-N, 0, 0]);
    c.clearAxis('x');
    c.setAxis('y', 1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, N, 0]);
    c.setAxis('y', -1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, -N, 0]);
    c.clearAxis('y');
    c.setAxis('z', 1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, N]);
    c.setAxis('z', -1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, -N]);
  });

  it('multiple axes together normalize as one 3D vector (diagonal not faster)', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 1);
    c.setAxis('y', 1);
    const d = c.buildStep(TCP, N).delta;
    expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(N, 12);
    expect(d[0]).toBeCloseTo(d[1], 12);
    expect(d[0]).toBeCloseTo(0.7071 * N, 4);
  });

  it('suppresses input inside the dead zone', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 0.05);
    const step = c.buildStep(TCP, N);
    expect(step.idle).toBe(true);
    expect(step.delta).toEqual([0, 0, 0]);
  });

  it('clamps out-of-range hardware values to [-1, 1]', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 5);
    expect(c.buildStep(TCP, N).delta).toEqual([N, 0, 0]);
  });
});

describe('CartesianMotionController — legacy sticks & buttons', () => {
  it('position stick maps x→±X, y→±Y', () => {
    const c = new CartesianMotionController();
    c.setPositionStick(1, 0);
    expect(c.buildStep(TCP, N).delta).toEqual([N, 0, 0]);
    c.setPositionStick(0, -1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, -N, 0]);
  });

  it('orientation stick vertical maps to ±Z; horizontal is carried as yaw', () => {
    const c = new CartesianMotionController();
    c.setOrientationStick(0, 1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, N]);
    c.setOrientationStick(0.8, 0);
    const step = c.buildStep(TCP, N);
    expect(step.target.orientation.yaw).toBeCloseTo(0.8, 12);
    expect(step.delta).toEqual([0, 0, 0]); // rotation alone: no translation
  });

  it('Z button overrides the analog Z while pressed', () => {
    const c = new CartesianMotionController();
    c.setAxis('z', -1);
    c.pressZ(1);
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, N]);
    c.releaseZ();
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, -N]);
  });
});

describe('CartesianMotionController — release safety', () => {
  it('clearAll zeroes every input', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 1);
    c.setAxis('z', 0.5);
    c.setPositionStick(0.5, 0.5);
    c.pressZ(-1);
    c.clearAll();
    expect(c.hasInput()).toBe(false);
    expect(c.buildStep(TCP, N).idle).toBe(true);
  });

  it('clearing one axis keeps the others active', () => {
    const c = new CartesianMotionController();
    c.setAxis('x', 1);
    c.setAxis('z', 1);
    c.clearAxis('x');
    expect(c.buildStep(TCP, N).delta).toEqual([0, 0, N]);
  });
});

describe('PREFERRED_MANUAL_POSTURE', () => {
  it('prefers a bent elbow (joint_3 far from 0) and defined values for all six joints', () => {
    expect(PREFERRED_MANUAL_POSTURE.joint_3).toBeCloseTo(Math.PI / 2, 12);
    expect(PREFERRED_MANUAL_POSTURE.joint_2).toBeCloseTo(-Math.PI / 4, 12);
    for (const j of ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6']) {
      expect(PREFERRED_MANUAL_POSTURE[j]).toBeDefined();
    }
  });
});
