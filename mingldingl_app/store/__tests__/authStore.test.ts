import { useAuthStore } from '../authStore';

// Ephemeral UI-only fields must NOT survive a restart via SecureStore
// persistence. Concrete regression this guards against: app/chat/[matchId]
// sets activeChatMatchId on mount and clears it on unmount, but if the OS
// kills the app while a chat is open, that cleanup never runs. If
// activeChatMatchId were persisted, the stale matchId would rehydrate on
// next launch and usePushNotifications.ts would suppress that match's push
// notifications indefinitely, believing the user is still viewing it.
describe('authStore persist config', () => {
  const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as any;

  function partialize(state: ReturnType<typeof useAuthStore.getState>) {
    const fn = useAuthStore.persist.getOptions().partialize;
    // Falls back to identity if no partialize is configured, mirroring
    // zustand's own default — this makes the assertions below fail loudly
    // (rather than silently no-op) if partialize is ever removed.
    return fn ? fn(state) : state;
  }

  it('keeps session in the persisted slice', () => {
    const state = { ...useAuthStore.getState(), session: fakeSession };
    const persisted = partialize(state) as Partial<typeof state>;

    expect(persisted.session).toBe(fakeSession);
  });

  it('excludes ephemeral UI-only fields from the persisted slice', () => {
    const state = {
      ...useAuthStore.getState(),
      session: fakeSession,
      streakBonusPending: true,
      pendingDrop: { nameKey: 'ring', rarity: 'Rare' },
      pendingTierUp: 'Opal',
      pendingNudge: { icon: 'heart', title: 'New match', matchId: 'm1' },
      activeChatMatchId: 'm1',
    };

    const persisted = partialize(state) as Record<string, unknown>;

    expect(persisted).not.toHaveProperty('streakBonusPending');
    expect(persisted).not.toHaveProperty('pendingDrop');
    expect(persisted).not.toHaveProperty('pendingTierUp');
    expect(persisted).not.toHaveProperty('pendingNudge');
    expect(persisted).not.toHaveProperty('activeChatMatchId');
  });
});
