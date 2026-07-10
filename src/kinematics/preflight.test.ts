import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { parseKeyConfig, type KeyConfig } from '../config/keyConfig';
import { approachUnitVector } from '../scene/coordinates';
import type { KinematicChain } from './chainTypes';
import { extractChain } from './extractChain';
import { DEFAULT_IK_OPTIONS } from './ikTypes';
import {
  keyWaypoints,
  runPreflight,
  runPreflightCancellable,
  type PreflightRequest,
} from './preflight';
import type { Vec3 } from './spatial';

const urdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');
const keyConfig: KeyConfig = parseKeyConfig(
  JSON.parse(readFileSync(resolve(process.cwd(), 'resources/key.config.json'), 'utf-8')),
);
const APPROACH = approachUnitVector(keyConfig.approach_axis) as Vec3;
const MAX_TILT = DEFAULT_IK_OPTIONS.maxTiltRad;

let chain: KinematicChain;
let request: PreflightRequest;
beforeAll(() => {
  const adapter = new RobotModelAdapter();
  adapter.parse(urdf);
  chain = extractChain(adapter.object!, 'base_link', 'stylus_tip');
  const keys: Record<string, Vec3> = {};
  for (const [id, c] of Object.entries(keyConfig.keys)) keys[id] = [c.x, c.y, c.z];
  request = {
    keys,
    approachAxis: APPROACH,
    // Required production profile only: six active joints; stylus_pitch locked.
    activeJoints: ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'],
    lockedValues: { stylus_pitch: 0 },
    hoverDistance: 0.05,
    descentSteps: 4,
  };
});

describe('keyWaypoints', () => {
  it('builds hover → descent → contact → retract along the approach axis', () => {
    const points = keyWaypoints([0.5, 0.05, 0.05], [0, 0, -1], 0.05, 4);
    expect(points[0]!.label).toBe('hover');
    expect(points[0]!.position[2]).toBeCloseTo(0.1, 12);
    const contactIdx = points.findIndex((p) => p.label === 'contact');
    expect(points[contactIdx]!.position[2]).toBeCloseTo(0.05, 12);
    expect(points[points.length - 1]!.label).toBe('retract-hover');
    // 1 hover + 4 descent (incl. contact) + 4 retract
    expect(points).toHaveLength(9);
  });

  it('descent follows global -Z (monotonic z decrease, x/y fixed)', () => {
    const points = keyWaypoints([0.6, -0.05, 0.05], [0, 0, -1], 0.05, 4);
    const descent = points.filter(
      (p) => p.phase === 'hover' || p.phase === 'descent' || p.phase === 'contact',
    );
    for (let i = 1; i < descent.length; i++) {
      expect(descent[i]!.position[2]).toBeLessThan(descent[i - 1]!.position[2]);
      expect(descent[i]!.position[0]).toBeCloseTo(0.6, 12);
      expect(descent[i]!.position[1]).toBeCloseTo(-0.05, 12);
    }
    // Retract climbs back along +Z.
    const retract = points.filter((p) => p.phase === 'retract');
    for (let i = 1; i < retract.length; i++) {
      expect(retract[i]!.position[2]).toBeGreaterThan(retract[i - 1]!.position[2]);
    }
  });
});

describe('runPreflight — competition_6dof, all six keys', () => {
  it('reaches every hover, descent, contact, and retract waypoint', () => {
    const result = runPreflight(chain, request);
    expect(result.allReachable).toBe(true);
    expect(result.keys).toHaveLength(6);
    for (const key of result.keys) {
      expect(key.reachable, `key ${key.key}`).toBe(true);
      expect(key.hoverSuccess).toBe(true);
      expect(key.descentSuccess).toBe(true);
      expect(key.contactSuccess).toBe(true);
      expect(key.retractSuccess).toBe(true);
      expect(key.worstPositionError).toBeLessThanOrEqual(DEFAULT_IK_OPTIONS.positionTolerance);
      expect(key.worstTiltRad, `key ${key.key} tilt`).toBeLessThanOrEqual(MAX_TILT);
      expect(key.waypoints).toHaveLength(9);
      // stylus_pitch stays exactly 0 at every waypoint.
      for (const w of key.waypoints) {
        expect(w.result.jointValues['stylus_pitch']).toBe(0);
        expect('stylus_pitch' in w.result.solution).toBe(false);
      }
    }
  });
});

describe('runPreflightCancellable', () => {
  it('completes normally when not cancelled', async () => {
    const outcome = await runPreflightCancellable(chain, request, () => false);
    expect('cancelled' in outcome).toBe(false);
    if (!('cancelled' in outcome)) {
      expect(outcome.allReachable).toBe(true);
    }
  });

  it('aborts promptly when cancellation is signalled', async () => {
    let cancel = false;
    const outcome = await runPreflightCancellable(
      chain,
      request,
      () => cancel,
      async () => {
        cancel = true;
      },
    );
    expect(outcome).toEqual({ cancelled: true });
  });
});
