import { create } from 'zustand';

/**
 * UI-only state (presentation concerns). Deliberately separate from runtime and
 * robot state: nothing here affects the command pipeline, safety, FK/IK, or the
 * robot. Keeping it isolated preserves the rule that runtime state lives outside
 * React and the UI only consumes snapshots.
 */

export type CameraPreset = 'overview' | 'front' | 'side' | 'top' | 'pin' | 'tool';

export const CAMERA_PRESETS: { id: CameraPreset; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Isometric overview of the cell' },
  { id: 'front', label: 'Front', hint: 'Look along +Y toward the arm' },
  { id: 'side', label: 'Side', hint: 'Look along the +X axis' },
  { id: 'top', label: 'Top', hint: 'Plan view from above (+Z)' },
  { id: 'pin', label: 'PIN', hint: 'Frame the six-key pad' },
  { id: 'tool', label: 'Tool Tip', hint: 'Track the stylus TCP' },
];

interface UiState {
  /** Reveals engineering diagnostics (FK verification, IK preflight). */
  advancedMode: boolean;
  toggleAdvanced: () => void;

  /** Selected camera framing. */
  cameraPreset: CameraPreset;
  /** Bumped on every selection so the camera rig re-animates even if unchanged. */
  cameraNonce: number;
  setCameraPreset: (preset: CameraPreset) => void;

  /** Judge demo walkthrough: null = inactive, otherwise 0-based step index. */
  demoStep: number | null;
  startDemo: () => void;
  nextDemo: () => void;
  prevDemo: () => void;
  exitDemo: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  advancedMode: false,
  toggleAdvanced: () => set((s) => ({ advancedMode: !s.advancedMode })),

  cameraPreset: 'overview',
  cameraNonce: 0,
  setCameraPreset: (cameraPreset) => set((s) => ({ cameraPreset, cameraNonce: s.cameraNonce + 1 })),

  demoStep: null,
  startDemo: () => set({ demoStep: 0 }),
  nextDemo: () => set((s) => ({ demoStep: s.demoStep === null ? 0 : s.demoStep + 1 })),
  prevDemo: () => set((s) => ({ demoStep: s.demoStep === null ? 0 : Math.max(0, s.demoStep - 1) })),
  exitDemo: () => set({ demoStep: null }),
}));
