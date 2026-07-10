import { create } from 'zustand';
import type { JointMeta } from '../robot/RobotModelAdapter';
import { DEFAULT_PROFILE, type RobotProfile } from '../config/robotProfiles';
import type { Vec3Tuple } from '../scene/coordinates';
import type { KinematicChain } from '../kinematics/chainTypes';
import type { PoseComparison } from '../kinematics/metrics';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface RobotState {
  status: LoadStatus;
  error: string | null;
  profile: RobotProfile;
  jointMeta: JointMeta[];
  /** Current commanded joint values (includes locked joints at their lock value). */
  jointValues: Record<string, number>;
  /**
   * World position of the rendered TCP link, in the base_link (world) frame, in
   * metres. `null` until the first valid sample is published after model load,
   * so the UI never shows fake zero telemetry.
   */
  tcp: Vec3Tuple | null;
  /** Currently highlighted target key id (visualization only in Gate 1). */
  targetKey: string | null;
  /** Extracted base_link → stylus_tip kinematic chain (Gate 2). */
  chain: KinematicChain | null;
  /**
   * Live comparison between the independent FK engine and the rendered Three.js
   * TCP. `null` until the first sample is published.
   */
  fkDiagnostics: PoseComparison | null;

  setStatus: (status: LoadStatus, error?: string | null) => void;
  setJointMeta: (meta: JointMeta[]) => void;
  setJointValue: (name: string, value: number) => void;
  setTcp: (tcp: Vec3Tuple) => void;
  setTargetKey: (key: string | null) => void;
  setChain: (chain: KinematicChain) => void;
  setFkDiagnostics: (diag: PoseComparison) => void;
}

export const useRobotStore = create<RobotState>((set) => ({
  status: 'idle',
  error: null,
  profile: DEFAULT_PROFILE,
  jointMeta: [],
  jointValues: {},
  tcp: null,
  targetKey: null,
  chain: null,
  fkDiagnostics: null,

  setStatus: (status, error = null) => set({ status, error }),

  setJointMeta: (meta) =>
    set((state) => {
      const jointValues: Record<string, number> = {};
      for (const m of meta) {
        jointValues[m.name] = state.profile.lockedJoints[m.name] ?? 0;
      }
      return { jointMeta: meta, jointValues };
    }),

  setJointValue: (name, value) =>
    set((state) => {
      // Locked joints (e.g. stylus_pitch in the competition profile) are held.
      if (name in state.profile.lockedJoints) {
        return {};
      }
      return { jointValues: { ...state.jointValues, [name]: value } };
    }),

  setTcp: (tcp) => set({ tcp }),

  setTargetKey: (targetKey) => set({ targetKey }),

  setChain: (chain) => set({ chain }),

  setFkDiagnostics: (fkDiagnostics) => set({ fkDiagnostics }),
}));
