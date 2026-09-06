import { render, fireEvent } from '@testing-library/react-native';
import CampaignScreen from '../[matchId]';
import { useCampaign } from '../../../hooks/useCampaign';
import type { Campaign } from '../../../hooks/useCampaign';
import { WithSafeArea } from '../../../lib/testing/safeArea';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../../hooks/useCampaign');

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: { setPendingDrop: jest.Mock }) => unknown) =>
    selector({ setPendingDrop: jest.fn() }),
}));

const mockUseCampaign = useCampaign as jest.Mock;

const campaign: Campaign = {
  rooms: [
    { roomId: 'gate', cleared: true, claimed: false, bonusScore: 5 },
    { roomId: 'echoes', cleared: true, claimed: true, bonusScore: 5 },
    { roomId: 'runes', cleared: false, claimed: false, bonusScore: 5 },
    { roomId: 'voices', cleared: false, claimed: false, bonusScore: 5 },
    { roomId: 'flame', cleared: false, claimed: false, bonusScore: 5 },
    { roomId: 'bridge', cleared: false, claimed: false, bonusScore: 5 },
    { roomId: 'threshold', cleared: false, claimed: false, bonusScore: 25 },
  ],
  clearedCount: 2,
  bossCleared: false,
  voicesMessageThreshold: 15,
};

function stubCampaign(overrides: Record<string, unknown> = {}) {
  mockUseCampaign.mockReturnValue({
    campaign,
    isLoading: false,
    unavailable: false,
    error: null,
    claimRoom: jest.fn(),
    isClaiming: false,
    claimingRoomId: null,
    lastClaim: null,
    ...overrides,
  });
}

describe('CampaignScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders every room by name', () => {
    stubCampaign();
    const { getByText } = render(<WithSafeArea><CampaignScreen /></WithSafeArea>);

    getByText('The Meeting Gate');
    getByText('Hall of Echoes');
    getByText('The Rune Chamber');
    getByText('Gate of Voices');
    getByText('The Flame Altar');
    getByText('The Pledge Bridge');
    getByText("The Dragon's Threshold");
  });

  it('offers a claim button for a cleared, unclaimed room and claims it', () => {
    const claimRoom = jest.fn();
    stubCampaign({ claimRoom });
    const { getByText } = render(<WithSafeArea><CampaignScreen /></WithSafeArea>);

    fireEvent.press(getByText(/claim spoils/i));

    expect(claimRoom).toHaveBeenCalledWith('gate', expect.anything());
  });

  it('marks sealed rooms and claimed rooms', () => {
    stubCampaign();
    const { getAllByText, getByText } = render(<WithSafeArea><CampaignScreen /></WithSafeArea>);

    expect(getAllByText('Sealed').length).toBeGreaterThan(0);
    getByText('Spoils claimed');
  });

  it('shows the current-room hint for the first uncleared room', () => {
    stubCampaign();
    const { getByText } = render(<WithSafeArea><CampaignScreen /></WithSafeArea>);

    getByText('Both face the Trial of Compatibility');
  });

  it('shows the closed state when the campaign is disabled', () => {
    stubCampaign({ campaign: null, unavailable: true });
    const { getByText } = render(<WithSafeArea><CampaignScreen /></WithSafeArea>);

    getByText('The campaign is closed for now.');
  });
});
