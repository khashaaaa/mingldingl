import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMatches, MATCH_PAGE_SIZE, MAX_MATCH_PAGES } from '../useMatches';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { matches: { list: jest.fn() } },
}));

const mockList = apiClient.matches.list as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function page(ids: string[], hasMore: boolean) {
  return { items: ids.map((matchId) => ({ matchId, otherUserId: `u-${matchId}` })), hasMore };
}

describe('useMatches', () => {
  beforeEach(() => mockList.mockReset());

  it('returns the single page when the engine reports no more', async () => {
    mockList.mockResolvedValueOnce(page(['a', 'b'], false));

    const { result } = renderHook(() => useMatches(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(1, MATCH_PAGE_SIZE);
  });

  it('follows hasMore so matches past the first page are not lost', async () => {
    mockList
      .mockResolvedValueOnce(page(['a'], true))
      .mockResolvedValueOnce(page(['b'], true))
      .mockResolvedValueOnce(page(['c'], false));

    const { result } = renderHook(() => useMatches(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(result.current.data?.map((m) => m.matchId)).toEqual(['a', 'b', 'c']);
    expect(mockList).toHaveBeenNthCalledWith(3, 3, MATCH_PAGE_SIZE);
  });

  it('stops at the page cap rather than looping forever on a bad hasMore', async () => {
    mockList.mockResolvedValue(page(['x'], true));

    const { result } = renderHook(() => useMatches(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(MAX_MATCH_PAGES));
    expect(mockList).toHaveBeenCalledTimes(MAX_MATCH_PAGES);
  });

  it('treats a short page as the end even if hasMore is missing', async () => {
    mockList.mockResolvedValueOnce({ items: [{ matchId: 'a' }] });

    const { result } = renderHook(() => useMatches(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(mockList).toHaveBeenCalledTimes(1);
  });
});
