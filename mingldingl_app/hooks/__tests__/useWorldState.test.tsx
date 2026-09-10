import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { newestMessageAt, useWorldState } from '../useWorldState';
import { queryKeys } from '../../lib/api/queryKeys';
import type { Message } from '../useChat';

function msg(id: string, createdAt: string): Message {
  return { id, matchId: 'm1', senderId: 'u1', content: 'hi', createdAt, status: 'sent' };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useWorldState', () => {
  it('knows nothing until the screens have asked', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useWorldState(), { wrapper });
    expect(result.current.budget).toBeNull();
    expect(result.current.activeMatches).toBeNull();
    expect(result.current.delve).toBeNull();
    expect(result.current.conversation).toBeNull();
    expect(typeof result.current.now).toBe('number');
  });

  it('never fetches: reading leaves no query behind', () => {
    const { client, wrapper } = setup();
    renderHook(() => useWorldState('m1'), { wrapper });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('reads the open conversation from the cached messages', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useWorldState('m1', 1_000), { wrapper });
    expect(result.current.conversation).toBeNull();

    act(() => {
      client.setQueryData<Message[]>(queryKeys.messages('m1'), []);
    });
    expect(result.current.conversation).toEqual({ lastMessageAt: null });

    act(() => {
      client.setQueryData<Message[]>(queryKeys.messages('m1'), [
        msg('a', '2026-09-10T10:00:00.000Z'),
        msg('b', '2026-09-10T11:30:00.000Z'),
        msg('c', '2026-09-10T09:00:00.000Z'),
      ]);
    });
    expect(result.current.conversation).toEqual({ lastMessageAt: '2026-09-10T11:30:00.000Z' });
    expect(result.current.now).toBe(1_000);
  });

  it('does not read another delve\'s thread', () => {
    const { client, wrapper } = setup();
    client.setQueryData<Message[]>(queryKeys.messages('other'), [msg('a', '2026-09-10T10:00:00.000Z')]);
    const { result } = renderHook(() => useWorldState('m1'), { wrapper });
    expect(result.current.conversation).toBeNull();
  });

  it('carries no conversation at all when no delve is open', () => {
    const { client, wrapper } = setup();
    client.setQueryData<Message[]>(queryKeys.messages('m1'), [msg('a', '2026-09-10T10:00:00.000Z')]);
    const { result } = renderHook(() => useWorldState(), { wrapper });
    expect(result.current.conversation).toBeNull();
  });
});

describe('newestMessageAt', () => {
  it('is null for an empty thread', () => {
    expect(newestMessageAt([])).toBeNull();
  });

  it('picks the latest timestamp regardless of order', () => {
    expect(newestMessageAt([
      msg('a', '2026-01-02T00:00:00.000Z'),
      msg('b', '2026-01-03T00:00:00.000Z'),
      msg('c', '2026-01-01T00:00:00.000Z'),
    ])).toBe('2026-01-03T00:00:00.000Z');
  });
});
