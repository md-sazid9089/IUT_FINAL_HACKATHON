import { describe, expect, it } from 'vitest';
import rawConfig from '../../resources/key.config.json';
import rawUrdf from '../../resources/6_dof_arm.urdf?raw';
import { parseKeyConfig } from '../config/keyConfig';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import { buildPoseCacheKey, clearPoseCache, getCachedPlan, hashText, setCachedPlan } from './poseCache';
import type { PinPlan } from './pinPlanner';

describe('pose cache', () => {
  it('keys cache entries by source hashes and stores only verified plans', async () => {
    clearPoseCache();
    const config = parseKeyConfig(rawConfig);
    const key = buildPoseCacheKey({
      urdfHash: await hashText(rawUrdf),
      keyConfigHash: await hashText(JSON.stringify(config)),
      profile: COMPETITION_6DOF,
      approachAxis: config.approach_axis,
    });
    const plan: PinPlan = {
      pin: '123456',
      approachAxis: [0, 0, -1],
      digits: [],
      waypoints: [],
      allVerified: true,
      worstPositionErrorM: 0,
      worstTiltRad: 0,
      maxJointDeltaRad: 0,
      minJointLimitMarginRad: 1,
      failureReason: null,
    };
    setCachedPlan(key, plan);
    expect(getCachedPlan(key, '123456')).toBe(plan);
    expect(getCachedPlan(`${key}:changed`, '123456')).toBeNull();
  });
});
