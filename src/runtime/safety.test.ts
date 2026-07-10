import { describe, expect, it } from 'vitest';
import type { JointMeta } from '../robot/RobotModelAdapter';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import { createJointTrajectory } from './trajectory';
import { precheckMoveJoints, validateTrajectory, type SafetyContext } from './safety';
import type { MoveJointsCommand } from './commands';

const META: JointMeta[] = [
  { name: 'joint_1', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 60, velocity: 2.5 },
  { name: 'joint_2', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 60, velocity: 2.5 },
  { name: 'joint_3', type: 'revolute', axis: [0, 1, 0], lower: -2.618, upper: 2.618, effort: 40, velocity: 3.0 },
  { name: 'joint_4', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 25, velocity: 3.5 },
  { name: 'joint_5', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 15, velocity: 4.0 },
  { name: 'joint_6', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 10, velocity: 4.5 },
  { name: 'stylus_pitch', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 8, velocity: 5.0 },
];

function ctx(overrides: Partial<SafetyContext> = {}): SafetyContext {
  return {
    jointMeta: META,
    profile: COMPETITION_6DOF,
    state: 'READY',
    eStopped: false,
    current: { joint_1: 0, joint_2: 0, joint_3: 0, joint_4: 0, joint_5: 0, joint_6: 0, stylus_pitch: 0 },
    maxJointJump: Math.PI,
    velocityTolerance: 1.001,
    ...overrides,
  };
}

function move(joints: Record<string, number>): MoveJointsCommand {
  return { type: 'move_joints', source: 'dashboard', id: 'x', issuedAt: 0, joints };
}

describe('precheckMoveJoints', () => {
  it('accepts an in-limit active-joint move', () => {
    expect(precheckMoveJoints(move({ joint_1: 0.5 }), ctx()).ok).toBe(true);
  });

  it('rejects when E-stopped', () => {
    const r = precheckMoveJoints(move({ joint_1: 0.1 }), ctx({ eStopped: true }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe('estopped');
  });

  it('rejects motion in a non-ready state', () => {
    const r = precheckMoveJoints(move({ joint_1: 0.1 }), ctx({ state: 'PLANNING' }));
    expect(r.code).toBe('state_forbids_motion');
  });

  it('rejects a non-finite target', () => {
    expect(precheckMoveJoints(move({ joint_1: Infinity }), ctx()).code).toBe('non_finite');
  });

  it('rejects an unknown joint', () => {
    expect(precheckMoveJoints(move({ joint_9: 0.1 }), ctx()).code).toBe('unknown_joint');
  });

  it('rejects moving the locked stylus_pitch off its lock value', () => {
    expect(precheckMoveJoints(move({ stylus_pitch: 0.5 }), ctx()).code).toBe('locked_joint');
  });

  it('allows commanding the locked joint to its exact lock value (no-op)', () => {
    expect(precheckMoveJoints(move({ stylus_pitch: 0 }), ctx()).ok).toBe(true);
  });

  it('rejects a joint-limit violation', () => {
    expect(precheckMoveJoints(move({ joint_1: 5 }), ctx()).code).toBe('joint_limit');
  });

  it('rejects an unsafe joint jump', () => {
    expect(precheckMoveJoints(move({ joint_1: 1.0 }), ctx({ maxJointJump: 0.1 })).code).toBe('joint_jump');
  });
});

describe('validateTrajectory', () => {
  it('accepts a velocity-compliant trajectory', () => {
    const traj = createJointTrajectory(['joint_1'], { joint_1: 0 }, { joint_1: 2 }, 1500);
    expect(validateTrajectory(traj, ctx()).ok).toBe(true);
  });

  it('rejects a trajectory that exceeds a joint velocity limit', () => {
    const traj = createJointTrajectory(['joint_1'], { joint_1: 0 }, { joint_1: 2 }, 100);
    const r = validateTrajectory(traj, ctx());
    expect(r.ok).toBe(false);
    expect(r.code).toBe('velocity_limit');
  });
});
