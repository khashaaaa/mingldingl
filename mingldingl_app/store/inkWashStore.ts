import { create } from 'zustand';

interface InkWashJob {
  id: number;
  /** Runs while the screen is covered: the navigation the wash is hiding. */
  then: () => void;
}

interface InkWashState {
  job: InkWashJob | null;
  clear: () => void;
}

/** The ink-wash passage the root layout draws (`InkWashHost`). One at a time. */
export const useInkWashStore = create<InkWashState>()((set) => ({
  job: null,
  clear: () => set({ job: null }),
}));

/**
 * Carry the player through ink: a wash covers the screen, `then` runs under it (a navigation),
 * and the wash draws back on the new room. For the big moments only — a new match opened from its
 * nudge — never ordinary navigation. A passage already running just runs `then` at once.
 */
export function passThroughInk(then: () => void): void {
  if (useInkWashStore.getState().job) {
    then();
    return;
  }
  useInkWashStore.setState({ job: { id: Date.now(), then } });
}
