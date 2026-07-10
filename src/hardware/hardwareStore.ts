import { create } from 'zustand';
import {
  DisabledHardwareTransport,
  type HardwareStatus,
  type HardwareTransport,
} from './hardwareTransport';

interface HardwareStoreState {
  transport: HardwareTransport;
  status: HardwareStatus;
  refresh: () => void;
  connectDisabled: () => Promise<void>;
}

const transport = new DisabledHardwareTransport();

export const useHardwareStore = create<HardwareStoreState>((set, get) => ({
  transport,
  status: transport.status(),
  refresh: () => set({ status: get().transport.status() }),
  connectDisabled: async () => {
    const status = await get().transport.connect();
    set({ status });
  },
}));
