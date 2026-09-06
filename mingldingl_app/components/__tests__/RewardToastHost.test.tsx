import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardToastHost } from '../RewardToastHost';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { scores: { detail: jest.fn(), ackNotification: jest.fn().mockResolvedValue({}) } },
}));

jest.mock('../modals/LootToast', () => ({ LootToast: () => null }));

const mockDetail = apiClient.scores.detail as jest.Mock;
const mockAck = apiClient.scores.ackNotification as jest.Mock;

function renderWithClient(ui: React.ReactElement, queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('RewardToastHost pending server rewards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAck.mockResolvedValue({});
    // useScoreDetail is session-gated, so the host only reads rewards for a signed-in user.
    useAuthStore.setState({ pendingDrop: null, pendingTierUp: null, streakBonusPending: false, session: { access_token: 't' } as never });
  });

  it('sets pendingDrop and acks when scoreDetail carries a pendingReferralReward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingReferralReward: { nameKey: 'item_title_wanderer', rarity: 'Common' },
    });

    renderWithClient(<RewardToastHost />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
    });
    expect(mockAck).toHaveBeenCalledWith('referral');
  });

  it('leaves pendingDrop untouched and does not ack when nothing is pending', async () => {
    mockDetail.mockResolvedValue({ totalScore: 100, gemTier: 'Garnet' });

    renderWithClient(<RewardToastHost />);

    await waitFor(() => expect(mockDetail).toHaveBeenCalled());
    expect(useAuthStore.getState().pendingDrop).toBeNull();
    expect(mockAck).not.toHaveBeenCalled();
  });

  it('does not replay an already-dismissed reward from the query cache on remount', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingReferralReward: { nameKey: 'item_title_wanderer', rarity: 'Common' },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = renderWithClient(<RewardToastHost />, queryClient);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
    });

    act(() => { useAuthStore.setState({ pendingDrop: null }); });
    first.unmount();

    renderWithClient(<RewardToastHost />, queryClient);

    await waitFor(() => expect(mockDetail).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().pendingDrop).toBeNull();
    expect(mockAck).toHaveBeenCalledTimes(1);
  });

  it('sets pendingDrop and acks when scoreDetail carries a pendingShipReward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingShipReward: { nameKey: 'item_title_threadweaver', rarity: 'Common' },
    });

    renderWithClient(<RewardToastHost />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_threadweaver', rarity: 'Common' });
    });
    expect(mockAck).toHaveBeenCalledWith('ship');
  });

  it('consumes one reward per pass when both are pending, queueing the ship reward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingReferralReward: { nameKey: 'item_title_wanderer', rarity: 'Common' },
      pendingShipReward: { nameKey: 'item_title_threadweaver', rarity: 'Common' },
    });

    renderWithClient(<RewardToastHost />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
    });
    expect(mockAck).toHaveBeenCalledTimes(1);
    expect(mockAck).toHaveBeenCalledWith('referral');

    act(() => { useAuthStore.setState({ pendingDrop: null }); });

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_threadweaver', rarity: 'Common' });
    });
    expect(mockAck).toHaveBeenCalledTimes(2);
    expect(mockAck).toHaveBeenLastCalledWith('ship');
  });
});
