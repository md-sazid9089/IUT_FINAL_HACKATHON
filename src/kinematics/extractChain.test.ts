import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { extractChain } from './extractChain';

const urdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');

function chain() {
  const adapter = new RobotModelAdapter();
  adapter.parse(urdf);
  return extractChain(adapter.object!, 'base_link', 'stylus_tip');
}

describe('extractChain', () => {
  it('extracts joint origins, axes, and types from the URDF nodes', () => {
    const c = chain();
    const j1 = c.joints.find((j) => j.name === 'joint_1')!;
    expect(j1.originXyz).toEqual([0, 0, 0.06]);
    expect(j1.axis).toEqual([0, 0, 1]);
    expect(j1.type).toBe('revolute');

    const j2 = c.joints.find((j) => j.name === 'joint_2')!;
    expect(j2.axis).toEqual([0, 1, 0]);
    expect(j2.originXyz).toEqual([0, 0, 0.25]);

    const tip = c.joints.find((j) => j.name === 'stylus_tip_frame')!;
    expect(tip.type).toBe('fixed');
    expect(tip.originXyz).toEqual([0, 0, 0.137]);
  });

  it('reads joint limits from the URDF', () => {
    const c = chain();
    const j3 = c.joints.find((j) => j.name === 'joint_3')!;
    expect(j3.limit?.lower).toBeCloseTo(-2.618, 4);
    expect(j3.limit?.upper).toBeCloseTo(2.618, 4);
    expect(j3.limit?.velocity).toBeCloseTo(3.0, 4);
  });

  it('throws for an unknown base or tip link', () => {
    const adapter = new RobotModelAdapter();
    adapter.parse(urdf);
    expect(() => extractChain(adapter.object!, 'nope', 'stylus_tip')).toThrow();
    expect(() => extractChain(adapter.object!, 'base_link', 'nope')).toThrow();
  });
});
