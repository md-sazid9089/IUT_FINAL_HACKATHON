import { describe, expect, it, vi } from 'vitest';
import type { JointMeta } from '../robot/RobotModelAdapter';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import type { IkResult } from '../kinematics/ikTypes';
import { RuntimeController, type Vec3 } from '../runtime/RuntimeController';
import { buildJogDelta, jogCommand, keysToDirection, SPEED_INCREMENTS } from './jogModel';

/**
 * Integration proof: manual joystick/keyboard commands built by the shared
 * jogModel flow through the REAL Gate 4 RuntimeController (schema → arbitration
 * → safety → IK → trajectory) and honour every safety rule.
 */

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
const N = SPEED_INCREMENTS.normal;

function ik(solution: Record<string, number>, verified = true): IkResult {
  return {
    status: verified ? 'converged' : 'diverged',
    solution,
    jointValues: { ...solution, stylus_pitch: 0 },
    iterations: 5,
    seedIndex: 0,
    positionError: verified ? 1e-6 : 1,
    tiltRad: 0,
    toolAxisDot: 1,
    verified,
    jointLimitMargin: 1,
    unsafeJump: null,
  };
}

interface HarnessOpts {
  ikSolve?: (p: Vec3, a: Vec3) => Promise<IkResult>;
}

function harness(opts: HarnessOpts = {}) {
  let time = 0;
  // Map a target TCP to a tiny, in-limit joint solution (deterministic stub).
  const defaultIk = vi.fn(async (p: Vec3): Promise<IkResult> => ik({ joint_1: p[0], joint_2: p[1], joint_3: p[2] }));
  const ikSolve = opts.ikSolve ?? defaultIk;
  const rc = new RuntimeController({
    jointMeta: META,
    profile: COMPETITION_6DOF,
    initialJoints: INITIAL,
    applyJoints: () => {},
    computeTcp: () => [0, 0, 0],
    now: () => time,
    snapshotHz: 1000,
    minDurationMs: 10,
    ikSolve,
  });
  rc.bringOnline();
  return {
    rc,
    ikSolve,
    advance: (ms: number) => {
      time += ms;
      rc.tick(ms);
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function runJog(h: ReturnType<typeof harness>, delta: Vec3, source: 'joystick' | 'keyboard') {
  h.rc.submit(jogCommand(source, delta));
  h.advance(1); // start planning
  await flush(); // IK resolves → EXECUTING
  h.advance(1000); // complete trajectory
  h.advance(1);
}

describe('manual integration — pipeline', () => {
  it('routes every manual command into the runtime and moves the robot', async () => {
    const h = harness();
    const r = h.rc.submit(jogCommand('keyboard', buildJogDelta(keysToDirection(['d']), N)));
    expect(r.accepted).toBe(true);
    h.advance(1);
    await flush();
    h.advance(1000);
    h.advance(1);
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(N, 9); // moved via IK stub
    expect(h.ikSolve).toHaveBeenCalled();
  });

  it('joystick and keyboard equivalents normalize identically', async () => {
    const a = harness();
    const b = harness();
    await runJog(a, buildJogDelta([1, 0, 0], N), 'joystick'); // full +X deflection
    await runJog(b, buildJogDelta(keysToDirection(['d']), N), 'keyboard'); // D
    expect(a.rc.getJointValues()).toEqual(b.rc.getJointValues());
  });

  it('invalid manual commands cause zero robot movement', async () => {
    const h = harness();
    const before = h.rc.getJointValues();
    const bad = h.rc.submit({ type: 'cartesian_jog', source: 'keyboard', delta: [NaN, 0, 0], approachAxis: [0, 0, -1] });
    expect(bad.accepted).toBe(false);
    h.advance(1);
    await flush();
    h.advance(1000);
    expect(h.rc.getJointValues()).toEqual(before);
  });

  it('keeps stylus_pitch exactly 0 through manual moves', async () => {
    const h = harness();
    await runJog(h, buildJogDelta([1, 1, 0], N), 'joystick');
    expect(h.rc.getJointValues().stylus_pitch).toBe(0);
  });

  it('enforces joint limits (out-of-limit IK solution is rejected)', async () => {
    const badIk = vi.fn(async (): Promise<IkResult> => ik({ joint_1: 100, joint_2: 0, joint_3: 0 }));
    const h = harness({ ikSolve: badIk });
    const before = h.rc.getJointValues();
    await runJog(h, buildJogDelta([1, 0, 0], N), 'keyboard');
    expect(h.rc.getJointValues()).toEqual(before); // no motion
    expect(h.rc.getState()).toBe('READY');
  });

  it('uses the IK solver for Cartesian requests', async () => {
    const h = harness();
    await runJog(h, buildJogDelta([0, 1, 0], N), 'joystick');
    expect(h.ikSolve).toHaveBeenCalledTimes(1);
  });

  it('E-stop immediately blocks manual input; reset re-enables it', async () => {
    const h = harness();
    h.rc.emergencyStop();
    h.advance(1); // → E_STOPPED
    const blocked = h.rc.submit(jogCommand('keyboard', buildJogDelta([1, 0, 0], N)));
    expect(blocked.accepted).toBe(false);
    expect(blocked.reason).toMatch(/E-stop|E-stopped/i);

    h.rc.resetEStop();
    h.advance(1); // → READY
    expect(h.rc.getState()).toBe('READY');
    await runJog(h, buildJogDelta([1, 0, 0], N), 'keyboard');
    expect(h.rc.getJointValues().joint_1).toBeCloseTo(N, 9);
  });

  it('rejects manual input while autonomous owns motion', async () => {
    // Long-running autonomous cartesian move that stays active.
    const slowIk = vi.fn(async (p: Vec3): Promise<IkResult> => ik({ joint_1: p[0] + 1, joint_2: 0, joint_3: 0 }));
    const h = harness({ ikSolve: slowIk });
    h.rc.submit({ type: 'cartesian_move', source: 'autonomous', position: [0.5, 0, 0], approachAxis: [0, 0, -1] });
    h.advance(1); // PLANNING (autonomous owns activeCommand)
    await flush(); // EXECUTING
    expect(h.rc.getState()).toBe('EXECUTING');

    const manual = h.rc.submit(jogCommand('keyboard', buildJogDelta([1, 0, 0], N)));
    expect(manual.accepted).toBe(false);
    expect(manual.reason).toMatch(/autonomous/);
  });
});
