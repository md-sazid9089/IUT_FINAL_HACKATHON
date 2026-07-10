import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import type { KinematicChain } from './chainTypes';
import { extractChain } from './extractChain';
import {
  computeForwardKinematics,
  toolAxisFromPose,
  type JointValues,
} from './forwardKinematics';
import { comparePoses, type PoseComparison } from './metrics';
import { deterministicFixtures, profileFixtures, seededConfigs } from './fixtures';

const urdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');

// Gate 2 acceptance tolerances.
const POSITION_TOL = 1e-4; // metres
const ORIENTATION_TOL = 1e-4; // radians
const TOOL_AXIS_DOT_MIN = 0.999999;

let adapter: RobotModelAdapter;
let chain: KinematicChain;

beforeAll(() => {
  adapter = new RobotModelAdapter();
  adapter.parse(urdf);
  chain = extractChain(adapter.object!, 'base_link', 'stylus_tip');
});

/** Three.js rendered reference pose for a given configuration. */
function reference(values: JointValues) {
  adapter.setJointValues(values);
  return {
    position: adapter.getTcpWorldPosition(),
    quaternion: adapter.getTcpWorldQuaternion(),
    toolAxis: adapter.getTcpWorldToolAxis(),
  };
}

/** Compare independent FK against the Three.js reference for one configuration. */
function compare(values: JointValues): PoseComparison {
  const fk = computeForwardKinematics(chain, values);
  // Guard: no NaN / Infinity anywhere in FK output.
  expect(Number.isFinite(fk.tcp.position[0])).toBe(true);
  expect(fk.tcp.quaternion.every((c) => Number.isFinite(c))).toBe(true);
  for (const name of Object.keys(fk.jointOrigins)) {
    expect(fk.jointOrigins[name]!.every((c) => Number.isFinite(c))).toBe(true);
    expect(fk.jointAxes[name]!.every((c) => Number.isFinite(c))).toBe(true);
  }

  const ref = reference(values);
  return comparePoses(
    fk.tcp.position,
    ref.position,
    fk.tcp.quaternion,
    ref.quaternion,
    toolAxisFromPose(fk.tcp),
    ref.toolAxis,
  );
}

function assertWithinTolerance(label: string, cmp: PoseComparison): void {
  expect(cmp.positionError, `${label} position`).toBeLessThanOrEqual(POSITION_TOL);
  expect(cmp.orientationError, `${label} orientation`).toBeLessThanOrEqual(ORIENTATION_TOL);
  expect(cmp.toolAxisDot, `${label} tool-axis`).toBeGreaterThanOrEqual(TOOL_AXIS_DOT_MIN);
}

describe('extracted chain', () => {
  it('runs base_link → stylus_tip and includes the locked stylus_pitch + fixed tip frame', () => {
    const names = chain.joints.map((j) => j.name);
    expect(names).toEqual([
      'joint_1',
      'joint_2',
      'joint_3',
      'joint_4',
      'joint_5',
      'joint_6',
      'stylus_pitch',
      'stylus_tip_frame',
    ]);
    expect(chain.joints.find((j) => j.name === 'stylus_pitch')!.type).toBe('revolute');
    expect(chain.joints.find((j) => j.name === 'stylus_tip_frame')!.type).toBe('fixed');
  });
});

describe('independent FK vs Three.js — zero pose', () => {
  it('places the TCP at approximately (0, 0, 1.497)', () => {
    const fk = computeForwardKinematics(chain, {});
    expect(fk.tcp.position[0]).toBeCloseTo(0, 4);
    expect(fk.tcp.position[1]).toBeCloseTo(0, 4);
    expect(fk.tcp.position[2]).toBeCloseTo(1.497, 3);
    assertWithinTolerance('zero', compare({}));
  });
});

describe('independent FK vs Three.js — deterministic fixtures', () => {
  it('matches within tolerance for every named fixture', () => {
    for (const fixture of deterministicFixtures(chain)) {
      assertWithinTolerance(fixture.label, compare(fixture.values));
    }
  });

  it('matches within tolerance for both robot profiles', () => {
    for (const fixture of profileFixtures(chain)) {
      assertWithinTolerance(fixture.label, compare(fixture.values));
    }
  });
});

describe('independent FK vs Three.js — 100 seeded legal configurations', () => {
  it('matches within tolerance for all 100 reproducible samples', () => {
    const configs = seededConfigs(chain, 100);
    expect(configs).toHaveLength(100);
    let worstPos = 0;
    let worstOri = 0;
    let worstDotShortfall = 0;
    for (const cfg of configs) {
      const cmp = compare(cfg.values);
      worstPos = Math.max(worstPos, cmp.positionError);
      worstOri = Math.max(worstOri, cmp.orientationError);
      worstDotShortfall = Math.max(worstDotShortfall, 1 - cmp.toolAxisDot);
      assertWithinTolerance(cfg.label, cmp);
    }
    // Sanity: worst-case errors are comfortably under budget.
    expect(worstPos).toBeLessThanOrEqual(POSITION_TOL);
    expect(worstOri).toBeLessThanOrEqual(ORIENTATION_TOL);
    expect(1 - worstDotShortfall).toBeGreaterThanOrEqual(TOOL_AXIS_DOT_MIN);
  });
});
