import { create } from 'zustand';
import { setSoundEnabled } from '../lib/world/feedback';
import { setStoredSound } from '../lib/world/soundPreference';

interface SoundState {
  enabled: boolean;
  /** Applied from storage at boot; no write back. */
  hydrate: (enabled: boolean) => void;
  set: (enabled: boolean) => void;
}

export const useSoundStore = create<SoundState>((set) => ({
  enabled: false,
  hydrate: (enabled) => {
    setSoundEnabled(enabled);
    set({ enabled });
  },
  set: (enabled) => {
    setSoundEnabled(enabled);
    set({ enabled });
    setStoredSound(enabled);
  },
}));
