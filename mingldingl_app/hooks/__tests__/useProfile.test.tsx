import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useUpdateProfile } from '../useProfile';
import { apiClient } from '../../lib/api/apiClient';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';
import type { UserProfile } from '../../models/user';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { update: jest.fn() } },
}));

const mockUpdate = apiClient.users.update as jest.Mock;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const cached = { id: 'u1', displayName: 'Bat', photoUrls: ['A', 'B', 'C'] } as UserProfile;

describe('useUpdateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the parsed server response into the profile cache', async () => {
    const qc = createAppQueryClient();
    qc.setQueryData(queryKeys.userProfile, cached);
    mockUpdate.mockResolvedValue({ id: 'u1', displayName: 'Bat', photoUrls: ['P', 'B', 'C'] });
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: makeWrapper(qc) });

    await act(() => result.current.mutateAsync({ photoUrls: ['P', 'B', 'C'] }));

    expect(mockUpdate).toHaveBeenCalledWith({ photoUrls: ['P', 'B', 'C'] });
    expect(qc.getQueryData<UserProfile>(queryKeys.userProfile)?.photoUrls).toEqual(['P', 'B', 'C']);
  });

  it('previews a patch and hands back an undo that restores the whole previous profile', () => {
    const qc = createAppQueryClient();
    qc.setQueryData(queryKeys.userProfile, cached);
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: makeWrapper(qc) });

    let undo: () => void = () => {};
    act(() => { undo = result.current.previewPatch({ photoUrls: ['local', 'B', 'C'] }); });
    expect(qc.getQueryData<UserProfile>(queryKeys.userProfile)?.photoUrls).toEqual(['local', 'B', 'C']);

    act(() => undo());
    expect(qc.getQueryData<UserProfile>(queryKeys.userProfile)).toEqual(cached);
  });

  it('previews without disturbing the fields the patch does not name', () => {
    const qc = createAppQueryClient();
    qc.setQueryData(queryKeys.userProfile, cached);
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: makeWrapper(qc) });

    act(() => { result.current.previewPatch({ photoUrls: ['local'] }); });

    expect(qc.getQueryData<UserProfile>(queryKeys.userProfile)?.displayName).toBe('Bat');
  });

  it('previewing an empty cache is a no-op, and so is its undo', () => {
    const qc = createAppQueryClient();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: makeWrapper(qc) });

    let undo: () => void = () => {};
    act(() => { undo = result.current.previewPatch({ photoUrls: ['local'] }); });
    expect(qc.getQueryData(queryKeys.userProfile)).toBeUndefined();

    act(() => undo());
    expect(qc.getQueryData(queryKeys.userProfile)).toBeUndefined();
  });

  it('leaves the cache untouched before the response when nothing was previewed', async () => {
    const qc = createAppQueryClient();
    qc.setQueryData(queryKeys.userProfile, cached);
    mockUpdate.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: makeWrapper(qc) });

    act(() => { void result.current.mutateAsync({ displayName: 'Dorj' }).catch(() => undefined); });

    expect(qc.getQueryData<UserProfile>(queryKeys.userProfile)?.displayName).toBe('Bat');
  });
});
