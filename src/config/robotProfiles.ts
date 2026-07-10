/**
 * Robot profiles resolve the 6-vs-7 joint discrepancy documented in
 * `docs/urdf-analysis.md`. The URDF declares seven revolute joints; the written
 * requirement describes a 6-DOF arm with a fixed stylus.
 *
 * `stylus_pitch` always remains a `revolute` joint in the URDF. In the default
 * competition profile it is *locked by configuration* (a control-layer
 * constraint), NOT edited in the URDF.
 */

export type ProfileId = 'competition_6dof' | 'model_7dof';

export interface RobotProfile {
  readonly id: ProfileId;
  readonly label: string;
  /** Joints the user/controller may drive. */
  readonly activeJoints: readonly string[];
  /** Joints held at a fixed value by configuration (still revolute in the URDF). */
  readonly lockedJoints: Readonly<Record<string, number>>;
}

const SIX_ARM_JOINTS = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'] as const;

export const COMPETITION_6DOF: RobotProfile = {
  id: 'competition_6dof',
  label: 'Competition 6-DOF (stylus_pitch locked)',
  activeJoints: [...SIX_ARM_JOINTS],
  lockedJoints: { stylus_pitch: 0 },
};

export const MODEL_7DOF: RobotProfile = {
  id: 'model_7dof',
  label: 'Model-faithful 7-DOF (stylus_pitch active)',
  activeJoints: [...SIX_ARM_JOINTS, 'stylus_pitch'],
  lockedJoints: {},
};

export const ROBOT_PROFILES: Record<ProfileId, RobotProfile> = {
  competition_6dof: COMPETITION_6DOF,
  model_7dof: MODEL_7DOF,
};

export const DEFAULT_PROFILE: RobotProfile = COMPETITION_6DOF;
