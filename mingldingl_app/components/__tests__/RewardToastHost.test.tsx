import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RewardToastHost } from '../RewardToastHost';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api/apiClient';
import { signal } from '../../lib/world/feedback';
import { __resetSession, getReforgedTint } from '../../lib/world/session';
import { GEM_COLORS } from '../../lib/theme';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { scores: { detail: jest.fn(), ackNotification: jest.fn().mockResolvedValue({}) } },
}));

jest.mock('../modals/LootToast', () => ({ LootToast: () => null }));
// The ceremony has its own tests; here it is a stub that reports which stones it was handed and
// exposes its dismissal, so the host's wiring is what is under test.
jest.mock('../modals/TierUpCeremony', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TierUpCeremony: ({ tier, previousTier, onDismiss }: { tier: string; previousTier: string; onDismiss: () => void }) => (
      <Pressable testID="tier-up-ceremony" onPress={onDismiss}>
        <Text>{`ceremony:${previousTier}->${tier}`}</Text>
      </Pressable>
    ),
  };
});
jest.mock('../../lib/world/feedback', () => ({ signal: jest.fn() }));

const mockDetail = apiClient.scores.detail as jest.Mock;
const mockAck = apiClient.scores.ackNotification as jest.Mock;
const mockSignal = signal as jest.Mock;

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
    __resetSession();
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

describe('RewardToastHost tier-up', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetail.mockResolvedValue({ totalScore: 100, gemTier: 'Garnet' });
    useAuthStore.setState({ pendingDrop: null, pendingTierUp: null, streakBonusPending: false, session: { access_token: 't' } as never });
    __resetSession();
  });

  it('holds the ceremony, not a toast, with the rung below as the stone being shed', () => {
    useAuthStore.setState({ pendingTierUp: 'Sapphire' });
    const { getByText } = renderWithClient(<RewardToastHost />);
    expect(getByText('ceremony:Amethyst->Sapphire')).toBeTruthy();
    expect(mockSignal).toHaveBeenCalledWith('tierUp');
  });

  it('sheds the same stone on the first rung, where there is nothing below', () => {
    useAuthStore.setState({ pendingTierUp: 'Garnet' });
    const { getByText } = renderWithClient(<RewardToastHost />);
    expect(getByText('ceremony:Garnet->Garnet')).toBeTruthy();
  });

  it('on dismissal tints the hold in the new gem and clears the pending tier-up', () => {
    useAuthStore.setState({ pendingTierUp: 'Emerald' });
    const { getByTestId, queryByTestId } = renderWithClient(<RewardToastHost />);
    expect(getReforgedTint()).toBeNull();

    fireEvent.press(getByTestId('tier-up-ceremony'));

    expect(getReforgedTint()).toBe(GEM_COLORS.Emerald);
    expect(useAuthStore.getState().pendingTierUp).toBeNull();
    expect(queryByTestId('tier-up-ceremony')).toBeNull();
  });

  it('gives the ceremony precedence over a pending honour', () => {
    useAuthStore.setState({ pendingTierUp: 'Opal', pendingDrop: { nameKey: 'item_title_wanderer', rarity: 'Gold' } });
    const { getByTestId } = renderWithClient(<RewardToastHost />);
    expect(getByTestId('tier-up-ceremony')).toBeTruthy();
  });
});
