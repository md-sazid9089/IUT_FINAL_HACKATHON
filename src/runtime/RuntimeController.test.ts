import { describe, expect, it } from 'vitest';
import type { JointMeta } from '../robot/RobotModelAdapter';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import type { IkResult } from '../kinematics/ikTypes';
import { RuntimeController, type RuntimeSnapshot, type Vec3 } from './RuntimeController';

const META: JointMeta[] = [
  { name: 'joint_1', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 60, velocity: 2.5 },
  { name: 'joint_2', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 60, velocity: 2.5 },
  { name: 'joint_3', type: 'revolute', axis: [0, 1, 0], lower: -2.618, upper: 2.618, effort: 40, velocity: 3.0 },
  { name: 'joint_4', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 25, velocity: 3.5 },
  { name: 'joint_5', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 15, velocity: 4.0 },
  { name: 'joint_6', type: 'revolute', axis: [0, 0, 1], lower: -3.1416, upper: 3.1416, effort: 10, velocity: 4.5 },
  { name: 'stylus_pitch', type: 'revolute', axis: [0, 1, 0], lower: -2.0944, upper: 2.0944, effort: 8, velocity: 5.0 },
];

const INITIAL = { joint_1: 0, joint_2: 0, joint_3: 0, joint_4: 0, joint_5: 0, joint_6: 0, stylus_pitch: 0 };

interface HarnessOpts {
  maxJointJump?: number;
  ikSolve?: (p: Vec3, a: Vec3) => Promise<IkResult>;
}

function harness(opts: HarnessOpts = {}) {
  let time = 0;
  const applied: Record<string, number>[] = [];
  let snapshot: RuntimeSnapshot | null = null;
  const rc = new RuntimeController({
    jointMeta: META,
    profile: COMPETITION_6DOF,
    initialJoints: INITIAL,
    applyJoints: (v) => applied.push({ ...v }),
    now: () => time,
    publish: (s) => (snapshot = s),
    snapshotHz: 1000,
    minDurationMs: 100,
    maxJointJump: opts.maxJointJump ?? Math.PI,
    ...(opts.ikSolve ? { ikSolve: opts.ikSolve } : {}),
  });
  rc.bringOnline();
  return {
    rc,
    applied,
    snapshot: () => snapshot,
    tick(ms = 16) {
      time += ms;
      rc.tick(ms);
    },
    runToIdle(step = 50, maxTicks = 400) {
      for (let i = 0; i < maxTicks; i++) {
        time += step;
        rc.tick(step);
        if (rc.getState() === 'READY' && i > 0) break;
      }
    },
  };
}

const move = (joints: Record<string, number>, source = 'dashboard') =>
  ({ type: 'move_joints', source, joints }) as const;

function verifiedIk(solution: Record<string, number>): IkResult {
  return {
    status: 'converged',
    solution,
    jointValues: { ...solution, stylus_pitch: 0 },
    iterations: 1,
    seedIndex: 0,
    positionError: 1e-6,
    tiltRad: 0.01,
    toolAxisDot: 1,
    verified: true,
    jointLimitMargin: 0.5,
    unsafeJump: null,
  };
}

describe('RuntimeController — happy path', () => {
  it('brings the runtime online to READY', () => {
    const h = harness();
    expect(h.rc.getState()).toBe('READY');
  });

  it('executes a joint move through the pipeline and reaches the goal', () => {
    const h = harness();
    expect(h.rc.submit(move({ joint_1: 0.5 })).accepted).toBe(true);
    h.runToIdle();
    expect(h.rc.getState()).toBe('READY');
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(0.5, 4);
  });

  it('respects the joint velocity limit during execution', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 2.0 })); // limit 2.5 rad/s
    let prev = 0;
    let maxSpeed = 0;
    for (let i = 0; i < 400; i++) {
      h.tick(50);
      const v = h.rc.getJointValues().joint_1!;
      maxSpeed = Math.max(maxSpeed, Math.abs(v - prev) / 0.05);
      prev = v;
      if (h.rc.getState() === 'READY' && i > 0) break;
    }
    expect(maxSpeed).toBeLessThanOrEqual(2.5 * 1.05);
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(2.0, 3);
  });
});

describe('RuntimeController — invalid commands cause zero movement', () => {
  it('rejects malformed/unknown/NaN/locked/limit/jump without moving the robot', () => {
    const h = harness({ maxJointJump: 0.1 });
    expect(h.rc.submit({ type: 'teleport', source: 'dashboard' }).accepted).toBe(false);
    expect(h.rc.submit({ nonsense: true }).accepted).toBe(false);
    expect(h.rc.submit(move({ joint_1: Infinity })).accepted).toBe(false);
    expect(h.rc.submit(move({ stylus_pitch: 0.5 })).accepted).toBe(false);
    expect(h.rc.submit(move({ joint_1: 99 })).accepted).toBe(false);
    expect(h.rc.submit(move({ joint_1: 1.0 })).accepted).toBe(false); // jump > 0.1
    for (let i = 0; i < 10; i++) h.tick(50);
    expect(h.rc.getJointValues().joint_1).toBe(0);
    // Every applied sample kept joints at the initial zero pose.
    for (const s of h.applied) expect(s.joint_1).toBe(0);
  });
});

describe('RuntimeController — E-stop', () => {
  it('is observed by the next tick, cancels motion, and blocks new movement', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 1.0 }));
    h.tick(50); // start executing
    h.tick(50);
    const mid = h.rc.getJointValues().joint_1!;
    expect(mid).toBeGreaterThan(0);

    h.rc.emergencyStop();
    expect(h.rc.isEStopped()).toBe(true);
    // New movement blocked immediately (before the tick even runs).
    expect(h.rc.submit(move({ joint_1: 0.2 })).accepted).toBe(false);

    h.tick(50);
    expect(h.rc.getState()).toBe('E_STOPPED');
    const frozen = h.rc.getJointValues().joint_1!;
    h.tick(50);
    expect(h.rc.getJointValues().joint_1).toBe(frozen); // no further motion
  });

  it('requires an explicit safe reset before moving again', () => {
    const h = harness();
    h.rc.emergencyStop();
    h.tick(16);
    expect(h.rc.getState()).toBe('E_STOPPED');
    expect(h.rc.submit(move({ joint_1: 0.3 })).accepted).toBe(false);

    // reset only valid from E_STOPPED
    expect(h.rc.resetEStop().accepted).toBe(true);
    h.tick(16);
    expect(h.rc.getState()).toBe('READY');
    expect(h.rc.submit(move({ joint_1: 0.3 })).accepted).toBe(true);
  });

  it('rejects reset when not E-stopped', () => {
    const h = harness();
    expect(h.rc.resetEStop().accepted).toBe(false);
  });

  it('discards a plan when E-stopped during planning (cancellation)', async () => {
    let resolveIk!: (r: IkResult) => void;
    const ikSolve = () => new Promise<IkResult>((res) => (resolveIk = res));
    const h = harness({ ikSolve });
    h.rc.submit({ type: 'cartesian_move', source: 'autonomous', position: [0.5, 0, 0.05], approachAxis: [0, 0, -1] });
    h.tick(16); // dequeue → PLANNING
    expect(h.rc.getState()).toBe('PLANNING');

    h.rc.emergencyStop();
    h.tick(16);
    expect(h.rc.getState()).toBe('E_STOPPED');

    // IK resolves late → must be discarded, no movement.
    resolveIk(verifiedIk({ joint_1: 0.5 }));
    await Promise.resolve();
    await Promise.resolve();
    h.tick(16);
    expect(h.rc.getState()).toBe('E_STOPPED');
    expect(h.rc.getJointValues().joint_1).toBe(0);
  });
});

describe('RuntimeController — stop / pause / resume are distinct', () => {
  it('stop cancels the trajectory, clears the queue, and holds position', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 1.0 }));
    h.rc.submit(move({ joint_2: 0.5 }));
    h.tick(50);
    h.tick(50);
    const held = h.rc.getJointValues().joint_1!;
    expect(held).toBeGreaterThan(0);

    expect(h.rc.submit({ type: 'stop', source: 'system' }).accepted).toBe(true);
    expect(h.rc.getState()).toBe('READY');
    h.tick(50);
    expect(h.rc.getState()).toBe('READY'); // queue cleared, nothing starts
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(held, 6);
    expect(h.rc.getJointValues().joint_2).toBe(0);
  });

  it('pause freezes motion and resume continues to the goal', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 1.0 }));
    h.tick(50);
    h.tick(50);
    expect(h.rc.submit({ type: 'pause', source: 'system' }).accepted).toBe(true);
    expect(h.rc.getState()).toBe('PAUSED');
    const paused = h.rc.getJointValues().joint_1!;
    h.tick(200);
    expect(h.rc.getJointValues().joint_1).toBe(paused); // frozen while paused

    expect(h.rc.submit({ type: 'resume', source: 'system' }).accepted).toBe(true);
    expect(h.rc.getState()).toBe('EXECUTING');
    h.runToIdle();
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(1.0, 3);
  });

  it('rejects pause when nothing is executing and resume when not paused', () => {
    const h = harness();
    expect(h.rc.submit({ type: 'pause', source: 'system' }).accepted).toBe(false);
    expect(h.rc.submit({ type: 'resume', source: 'system' }).accepted).toBe(false);
  });
});

describe('RuntimeController — arbitration', () => {
  it('a higher-priority command preempts a lower-priority one', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 0.8 }, 'joystick'));
    h.tick(50);
    expect(h.snapshot()?.activeCommand?.source).toBe('joystick');

    h.rc.submit(move({ joint_1: -0.8 }, 'autonomous'));
    h.runToIdle();
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(-0.8, 3);
  });

  it('runs two simultaneous same-priority commands in order', () => {
    const h = harness();
    h.rc.submit(move({ joint_1: 0.3 }));
    h.rc.submit(move({ joint_2: 0.4 }));
    h.runToIdle();
    // first completed, then second dequeued
    for (let i = 0; i < 200; i++) h.tick(50);
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(0.3, 3);
    expect(h.rc.getJointValues().joint_2).toBeCloseTo(0.4, 3);
  });
});
