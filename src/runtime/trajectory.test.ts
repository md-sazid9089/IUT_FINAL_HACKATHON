import { describe, expect, it } from 'vitest';
import {
  createJointTrajectory,
  minJerkDuration,
  peakSpeeds,
  quinticS,
  quinticSPrime,
  sampleTrajectory,
  type JointLimitInfo,
} from './trajectory';

describe('quintic s(τ)', () => {
  it('is 0 at 0, 1 at 1, 0.5 at midpoint', () => {
    expect(quinticS(0)).toBeCloseTo(0, 12);
    expect(quinticS(1)).toBeCloseTo(1, 12);
    expect(quinticS(0.5)).toBeCloseTo(0.5, 12);
  });

  it('has zero velocity at both ends and peak 1.875 at τ=0.5', () => {
    expect(quinticSPrime(0)).toBeCloseTo(0, 12);
    expect(quinticSPrime(1)).toBeCloseTo(0, 12);
    expect(quinticSPrime(0.5)).toBeCloseTo(1.875, 12);
  });
});

describe('minJerkDuration + peakSpeeds', () => {
  const limits: JointLimitInfo[] = [{ name: 'joint_1', velocity: 2.5 }];

  it('picks a duration that keeps peak speed within the velocity limit', () => {
    const start = { joint_1: 0 };
    const goal = { joint_1: 2.0 };
    const durationMs = minJerkDuration(start, goal, limits, 100);
    // required = |Δq|·1.875 / vlim = 2·1.875/2.5 = 1.5 s
    expect(durationMs).toBeCloseTo(1500, 6);
    const traj = createJointTrajectory(['joint_1'], start, goal, durationMs);
    expect(peakSpeeds(traj)['joint_1']!).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it('respects the minimum-duration floor for tiny moves', () => {
    const durationMs = minJerkDuration({ joint_1: 0 }, { joint_1: 0.001 }, limits, 200);
    expect(durationMs).toBe(200);
  });
});

describe('sampleTrajectory', () => {
  it('interpolates from start to goal along the quintic', () => {
    const traj = createJointTrajectory(['joint_1'], { joint_1: 0 }, { joint_1: 1 }, 1000);
    traj.elapsedMs = 0;
    expect(sampleTrajectory(traj)['joint_1']!).toBeCloseTo(0, 12);
    traj.elapsedMs = 500;
    expect(sampleTrajectory(traj)['joint_1']!).toBeCloseTo(0.5, 12);
    traj.elapsedMs = 1000;
    expect(sampleTrajectory(traj)['joint_1']!).toBeCloseTo(1, 12);
  });
});
