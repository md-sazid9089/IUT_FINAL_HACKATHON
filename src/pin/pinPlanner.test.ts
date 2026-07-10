import { describe, expect, it } from 'vitest';
import rawConfig from '../../resources/key.config.json';
import rawUrdf from '../../resources/6_dof_arm.urdf?raw';
import { parseKeyConfig } from '../config/keyConfig';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import { extractChain } from '../kinematics/extractChain';
import { COMPETITION_6DOF } from '../config/robotProfiles';
import { planPinSequence } from './pinPlanner';

const config = parseKeyConfig(rawConfig);
const adapter = new RobotModelAdapter();
adapter.parse(rawUrdf);
const chain = extractChain(adapter.object!, 'base_link', 'stylus_tip');

describe('planPinSequence', () => {
  it('generates verified waypoint plans for the required PIN examples', () => {
    for (const pin of ['123456', '654321', '555555']) {
      const plan = planPinSequence(chain, config, pin);
      expect(plan.pin).toBe(pin);
      expect(plan.digits).toHaveLength(6);
      expect(plan.waypoints.length).toBeGreaterThan(6);
      expect(plan.allVerified, plan.failureReason ?? pin).toBe(true);
      expect(plan.worstPositionErrorM).toBeLessThanOrEqual(0.005);
      for (const waypoint of plan.waypoints) {
        expect(waypoint.ik.jointValues.stylus_pitch).toBe(COMPETITION_6DOF.lockedJoints.stylus_pitch);
        expect(Object.keys(waypoint.ik.solution).sort()).toEqual([...COMPETITION_6DOF.activeJoints].sort());
      }
    }
  }, 60000);
});
