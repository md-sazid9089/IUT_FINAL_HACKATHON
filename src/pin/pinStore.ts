import { create } from 'zustand';
import type { PinState } from './pinConfig';
import type { PinPlan } from './pinPlanner';
import type { PinRunReport, RepeatabilityStats } from './pinReports';

export interface PinStoreState {
  pin: string;
  validationMessage: string | null;
  state: PinState;
  activeDigitIndex: number | null;
  activeKey: string | null;
  stage: string | null;
  plan: PinPlan | null;
  report: PinRunReport | null;
  history: PinRunReport[];
  repeatability: RepeatabilityStats | null;
  error: string | null;
  elapsedMs: number;
  setPin: (pin: string) => void;
  resetPin: () => void;
  setStatus: (patch: Partial<Omit<PinStoreState, 'setPin' | 'resetPin' | 'setStatus'>>) => void;
  addReport: (report: PinRunReport) => void;
}

export const usePinStore = create<PinStoreState>((set) => ({
  pin: '',
  validationMessage: null,
  state: 'IDLE',
  activeDigitIndex: null,
  activeKey: null,
  stage: null,
  plan: null,
  report: null,
  history: [],
  repeatability: null,
  error: null,
  elapsedMs: 0,
  setPin: (pin) => set({ pin: pin.replace(/\s/g, ''), validationMessage: null }),
  resetPin: () =>
    set({
      pin: '',
      validationMessage: null,
      state: 'IDLE',
      activeDigitIndex: null,
      activeKey: null,
      stage: null,
      plan: null,
      report: null,
      error: null,
      elapsedMs: 0,
    }),
  setStatus: (patch) => set(patch),
  addReport: (report) =>
    set((state) => ({
      report,
      history: [report, ...state.history].slice(0, 20),
    })),
}));
