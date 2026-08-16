import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { createChunkedStore } from '../lib/secureStoreChunked';

interface AuthState {
  session: Session | null;
  setSession: (session: Session | null) => void;
  streakBonusPending: boolean;
  setStreakBonusPending: (bonusPending: boolean) => void;
  pendingDrop: { nameKey: string; rarity: string } | null;
  setPendingDrop: (drop: { nameKey: string; rarity: string } | null) => void;
  pendingTierUp: string | null;
  setPendingTierUp: (tier: string | null) => void;
  pendingNudge: { icon: string; title: string; matchId: string } | null;
  setPendingNudge: (nudge: { icon: string; title: string; matchId: string } | null) => void;
  activeChatMatchId: string | null;
  setActiveChatMatchId: (matchId: string | null) => void;
  clearSession: () => void;
}

// The persisted session (Supabase's full JWT + refresh token + user
// metadata) regularly exceeds SecureStore's 2048-byte per-item limit —
// same reasoning as lib/supabase.ts, which this mirrors so a write here
// can't silently fail (setItemAsync rejects above the limit, and zustand's
// persist middleware never surfaces that rejection).
const secureStorage = createJSONStorage(() => createChunkedStore({
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}));

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      streakBonusPending: false,
      setStreakBonusPending: (bonusPending) => set({ streakBonusPending: bonusPending }),
      pendingDrop: null,
      setPendingDrop: (drop) => set({ pendingDrop: drop }),
      pendingTierUp: null,
      setPendingTierUp: (tier) => set({ pendingTierUp: tier }),
      pendingNudge: null,
      setPendingNudge: (nudge) => set({ pendingNudge: nudge }),
      activeChatMatchId: null,
      setActiveChatMatchId: (matchId) => set({ activeChatMatchId: matchId }),
      clearSession: () => set({ session: null, streakBonusPending: false, pendingDrop: null, pendingTierUp: null, pendingNudge: null, activeChatMatchId: null }),
    }),
    {
      name: 'auth-store',
      storage: secureStorage,
      // Only session/auth state is meant to survive a restart. The rest
      // (streakBonusPending, pendingDrop/pendingTierUp/pendingNudge,
      // activeChatMatchId) are one-shot, ephemeral UI signals — set on some
      // event and cleared moments later by whichever screen consumes them.
      // Without partialize, persist() writes ALL of them to SecureStore on
      // every set() and rehydrates them on next launch. Concretely: if the
      // OS kills the app while a chat is open, app/chat/[matchId].tsx's
      // unmount cleanup (which clears activeChatMatchId) never runs, so the
      // stale matchId persists into the next session — and
      // usePushNotifications.ts then treats that match as "currently being
      // viewed" and suppresses its push notifications indefinitely.
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
