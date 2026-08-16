import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameHeader } from '../GameHeader';
import { useAuthStore } from '../../../store/authStore';
import { apiClient } from '../../../lib/api/apiClient';

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { scores: { detail: jest.fn() } },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
// ScoreHUD pulls in GemTierBadge -> TorchGlow -> @shopify/react-native-skia,
// which Jest can't parse (ESM, not covered by transformIgnorePatterns) — no
// existing test previously rendered anything on that chain. This suite only
// needs GameHeader's pendingReferralReward effect, not real ScoreHUD visuals,
// so stub it out to keep the import graph out of the render.
jest.mock('../../progression/ScoreHUD', () => ({ ScoreHUD: () => null }));

const mockDetail = apiClient.scores.detail as jest.Mock;

function renderWithClient(ui: React.ReactElement, queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('GameHeader pending referral reward', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingDrop: null });
  });

  it('sets pendingDrop when scoreDetail carries a pendingReferralReward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingReferralReward: { nameKey: 'item_title_wanderer', rarity: 'Common' },
    });

    renderWithClient(<GameHeader title="Seek Companions" showScore />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
    });
  });

  it('leaves pendingDrop untouched when scoreDetail has no pendingReferralReward', async () => {
    mockDetail.mockResolvedValue({ totalScore: 100, gemTier: 'Garnet' });

    renderWithClient(<GameHeader title="Seek Companions" showScore />);

    await waitFor(() => expect(mockDetail).toHaveBeenCalled());
    expect(useAuthStore.getState().pendingDrop).toBeNull();
  });

  it('does not replay an already-dismissed reward from the query cache on remount', async () => {
    // Simulates navigating between screens within the 60s staleTime window:
    // GameHeader unmounts and remounts (fresh component instance) against
    // the SAME QueryClient, so the stale cache entry is still there unless
    // the effect clears it out on consumption.
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingReferralReward: { nameKey: 'item_title_wanderer', rarity: 'Common' },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = renderWithClient(<GameHeader title="Discover" showScore />, queryClient);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
    });

    // User dismisses the toast, then navigates away.
    useAuthStore.setState({ pendingDrop: null });
    first.unmount();

    // A second GameHeader mounts on the new screen, reusing the same
    // QueryClient (and thus the same cache entry, still within staleTime).
    renderWithClient(<GameHeader title="Matches" showScore />, queryClient);

    // Give the effect a chance to run; it should find nothing pending now
    // because the first mount cleared pendingReferralReward from the cache.
    await waitFor(() => expect(mockDetail).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().pendingDrop).toBeNull();
  });

  it('sets pendingDrop when scoreDetail carries a pendingShipReward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingShipReward: { nameKey: 'item_title_threadweaver', rarity: 'Common' },
    });

    renderWithClient(<GameHeader title="Seek Companions" showScore />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_threadweaver', rarity: 'Common' });
    });
  });
});
