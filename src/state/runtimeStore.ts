import { create } from 'zustand';
import type { RuntimeSnapshot } from '../runtime/RuntimeController';

/**
 * Throttled UI mirror of the runtime. The RuntimeController publishes snapshots
 * here at ~15 Hz; React reads from here. High-frequency runtime state lives on
 * the controller (outside React), never in this store.
 */
interface RuntimeStoreState {
  snapshot: RuntimeSnapshot | null;
  setSnapshot: (snapshot: RuntimeSnapshot) => void;
}

export const useRuntimeStore = create<RuntimeStoreState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
