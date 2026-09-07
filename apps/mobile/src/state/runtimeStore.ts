import { create } from 'zustand';
import type { ProviderReadiness } from '@wake/domain';

import type { NativeActiveAlarm } from '../../modules/wake-alarm';

export type RuntimeEvent = { at: string; text: string };

type RuntimeState = {
  activeAlarm: NativeActiveAlarm | null;
  spotifyReadiness: ProviderReadiness | null;
  events: RuntimeEvent[];
  setActiveAlarm: (a: NativeActiveAlarm | null) => void;
  setSpotifyReadiness: (r: ProviderReadiness | null) => void;
  pushEvent: (text: string) => void;
};

/** Ephemeral UI state only — durable state lives in SQLite / native stores (spec §60). */
export const useRuntimeStore = create<RuntimeState>((set) => ({
  activeAlarm: null,
  spotifyReadiness: null,
  events: [],
  setActiveAlarm: (activeAlarm) => set({ activeAlarm }),
  setSpotifyReadiness: (spotifyReadiness) => set({ spotifyReadiness }),
  pushEvent: (text) =>
    set((s) => ({ events: [{ at: new Date().toISOString(), text }, ...s.events].slice(0, 50) })),
}));
