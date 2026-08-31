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

  activeChatStack: string[];
  pushActiveChat: (matchId: string) => void;
  popActiveChat: (matchId: string) => void;
  clearSession: () => void;
}

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
      activeChatStack: [],
      pushActiveChat: (matchId) => set((s) => {
        const stack = [...s.activeChatStack, matchId];
        return { activeChatStack: stack, activeChatMatchId: stack[stack.length - 1] ?? null };
      }),
      popActiveChat: (matchId) => set((s) => {
        const stack = [...s.activeChatStack];
        const idx = stack.lastIndexOf(matchId);
        if (idx !== -1) stack.splice(idx, 1);
        return { activeChatStack: stack, activeChatMatchId: stack[stack.length - 1] ?? null };
      }),
      clearSession: () => set({ session: null, streakBonusPending: false, pendingDrop: null, pendingTierUp: null, pendingNudge: null, activeChatMatchId: null, activeChatStack: [] }),
    }),
    {
      name: 'auth-store',
      storage: secureStorage,
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
