import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMyUserId } from '../useMyUserId';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { me: jest.fn() } },
}));

const mockMe = apiClient.users.me as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyUserId', () => {
  beforeEach(() => {
    mockMe.mockReset();
    useAuthStore.setState({ session: { user: { id: 'supabase-sub' }, access_token: 't' } as never });
  });

  // Every sign-in mints a fresh anonymous Supabase identity, which the engine aliases onto the
  // account that owns the claimed phone. So the JWT `sub` is not the id the engine puts on
  // messages, icebreaker answers or nudges — comparing against it made a returning user's own
  // messages render as the other person's.
  it('prefers the engine account id over the Supabase sub', async () => {
    mockMe.mockResolvedValue({ id: 'engine-user-id', displayName: 'Undram' });

    const { result } = renderHook(() => useMyUserId(), { wrapper });

    await waitFor(() => expect(result.current).toBe('engine-user-id'));
  });

  it('falls back to the Supabase sub before the profile resolves', () => {
    mockMe.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMyUserId(), { wrapper });

    expect(result.current).toBe('supabase-sub');
  });
});
