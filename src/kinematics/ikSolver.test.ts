import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { parseKeyConfig, type KeyConfig } from '../config/keyConfig';
import { approachUnitVector } from '../scene/coordinates';
import type { KinematicChain } from './chainTypes';
import { extractChain } from './extractChain';
import { computeForwardKinematics } from './forwardKinematics';
import { solveIK } from './ikSolver';
import { DEFAULT_IK_OPTIONS } from './ikTypes';
import type { Vec3 } from './spatial';

const urdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');
const keyConfig: KeyConfig = parseKeyConfig(
  JSON.parse(readFileSync(resolve(process.cwd(), 'resources/key.config.json'), 'utf-8')),
);

// Judged production profile: six active arm joints; stylus_pitch locked at 0.
const ACTIVE = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
const LOCKED = { stylus_pitch: 0 };
const APPROACH = approachUnitVector(keyConfig.approach_axis) as Vec3;
const MAX_TILT = DEFAULT_IK_OPTIONS.maxTiltRad;

let chain: KinematicChain;
beforeAll(() => {
  const adapter = new RobotModelAdapter();
  adapter.parse(urdf);
  chain = extractChain(adapter.object!, 'base_link', 'stylus_tip');
});

function contact(id: string): Vec3 {
  const c = keyConfig.keys[id]!;
  return [c.x, c.y, c.z];
}
function hover(id: string): Vec3 {
  const c = keyConfig.keys[id]!;
  return [c.x, c.y, c.z + 0.05];
}

function solveKey(target: Vec3) {
  return solveIK(chain, {
    target: { position: target, approachAxis: APPROACH },
    activeJoints: ACTIVE,
    lockedValues: LOCKED,
  });
}

describe('solveIK — competition_6dof (stylus_pitch locked, soft bounded tilt)', () => {
  it('solves all six hover and contact targets within position tolerance and max tilt', () => {
    let worstTilt = 0;
    for (const id of Object.keys(keyConfig.keys)) {
      for (const target of [hover(id), contact(id)]) {
        const r = solveKey(target);
        expect(r.status, `key ${id}`).toBe('converged');
        expect(r.verified, `key ${id} verified`).toBe(true);
        expect(r.positionError, `key ${id} pos`).toBeLessThanOrEqual(
          DEFAULT_IK_OPTIONS.positionTolerance,
        );
        expect(r.tiltRad, `key ${id} tilt`).toBeLessThanOrEqual(MAX_TILT);
        worstTilt = Math.max(worstTilt, r.tiltRad);
      }
    }
    // The measured worst tilt stays comfortably below the 20° bound.
    expect(worstTilt).toBeLessThanOrEqual(MAX_TILT);
  });

  it('keeps stylus_pitch exactly locked at 0 in every solution', () => {
    for (const id of Object.keys(keyConfig.keys)) {
      const r = solveKey(contact(id));
      expect(r.jointValues['stylus_pitch']).toBe(0);
    }
  });

  it('uses only the six active joint variables (no stylus_pitch as a variable)', () => {
    const r = solveKey(contact('1'));
    expect(Object.keys(r.solution).sort()).toEqual([...ACTIVE].sort());
    expect('stylus_pitch' in r.solution).toBe(false);
  });

  it('produces distinct solutions per key (no hardcoded joint arrays)', () => {
    const j1 = Object.keys(keyConfig.keys).map((id) => solveKey(contact(id)).solution['joint_1']!);
    expect(new Set(j1.map((v) => v.toFixed(4))).size).toBeGreaterThan(1);
  });

  it('independently verifies each final pose with FK', () => {
    for (const id of Object.keys(keyConfig.keys)) {
      const target = contact(id);
      const r = solveKey(target);
      const fk = computeForwardKinematics(chain, r.jointValues);
      const p = fk.tcp.position;
      const posErr = Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);
      expect(posErr).toBeLessThanOrEqual(DEFAULT_IK_OPTIONS.positionTolerance);
    }
  });
});

describe('solveIK — invalid and unreachable requests fail clearly', () => {
  it('flags an empty active-joint set as invalid', () => {
    const r = solveIK(chain, {
      target: { position: [0.5, 0, 0.05], approachAxis: APPROACH },
      activeJoints: [],
      lockedValues: LOCKED,
    });
    expect(r.status).toBe('invalid');
  });

  it('flags a zero approach axis as invalid', () => {
    const r = solveIK(chain, {
      target: { position: [0.5, 0, 0.05], approachAxis: [0, 0, 0] },
      activeJoints: ACTIVE,
      lockedValues: LOCKED,
    });
    expect(r.status).toBe('invalid');
  });

  it('does not falsely verify an out-of-reach target', () => {
    const r = solveKey([5, 5, 5]);
    expect(r.status).not.toBe('converged');
    expect(r.verified).toBe(false);
    expect(r.positionError).toBeGreaterThan(1e-3);
  });
});
