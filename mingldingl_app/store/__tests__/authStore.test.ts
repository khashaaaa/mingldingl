import { useAuthStore } from '../authStore';

describe('authStore persist config', () => {
  const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as any;

  function partialize(state: ReturnType<typeof useAuthStore.getState>) {
    const fn = useAuthStore.persist.getOptions().partialize;

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
    expect(persisted).not.toHaveProperty('activeChatStack');
  });
});

describe('authStore active chat stack', () => {
  beforeEach(() => {
    useAuthStore.setState({ activeChatMatchId: null, activeChatStack: [] });
  });

  it('reflects the top of the stack as chats push and pop in LIFO order', () => {
    const s = () => useAuthStore.getState();

    s().pushActiveChat('A');
    expect(s().activeChatMatchId).toBe('A');

    s().pushActiveChat('B');
    expect(s().activeChatMatchId).toBe('B');

    s().popActiveChat('B');
    expect(s().activeChatMatchId).toBe('A');

    s().popActiveChat('A');
    expect(s().activeChatMatchId).toBeNull();
  });

  it('keeps the top intact when a lower entry pops out of order', () => {
    const s = () => useAuthStore.getState();
    s().pushActiveChat('A');
    s().pushActiveChat('B');

    s().popActiveChat('A');
    expect(s().activeChatMatchId).toBe('B');

    s().popActiveChat('B');
    expect(s().activeChatMatchId).toBeNull();
  });

  it('removes only one occurrence when the same chat appears twice', () => {
    const s = () => useAuthStore.getState();
    s().pushActiveChat('A');
    s().pushActiveChat('A');

    s().popActiveChat('A');
    expect(s().activeChatMatchId).toBe('A');

    s().popActiveChat('A');
    expect(s().activeChatMatchId).toBeNull();
  });

  it('tolerates popping a matchId that is not on the stack', () => {
    const s = () => useAuthStore.getState();
    s().pushActiveChat('A');

    s().popActiveChat('ghost');
    expect(s().activeChatMatchId).toBe('A');
  });

  it('clearSession resets the stack and the derived field', () => {
    const s = () => useAuthStore.getState();
    s().pushActiveChat('A');
    s().pushActiveChat('B');

    s().clearSession();
    expect(s().activeChatMatchId).toBeNull();
    expect(s().activeChatStack).toEqual([]);
  });
});
