import { render } from '@testing-library/react-native';
import CampaignScreen from '../[matchId]';
import type { Campaign } from '../../../hooks/useCampaign';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('../../../hooks/useScrollTail', () => ({ useScrollTail: () => 0 }));
jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ setPendingDrop: jest.fn() }),
}));

let mockCampaign: Campaign;
const mockClaimRoom = jest.fn();

jest.mock('../../../hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: mockCampaign,
    isLoading: false,
    unavailable: false,
    error: null,
    claimRoom: mockClaimRoom,
    isClaiming: false,
    claimingRoomId: null,
  }),
}));

// The seven caverns in list order — `threshold` (the dragon) is always last, per BOSS_ROOM_ID
// in app/campaign/[matchId].tsx.
const ROOM_IDS = ['gate', 'echoes', 'runes', 'voices', 'flame', 'bridge', 'threshold'];

function campaignOf(rooms: { cleared: boolean; claimed: boolean; bonusScore?: number }[]): Campaign {
  return {
    rooms: rooms.map((r, i) => ({ roomId: ROOM_IDS[i], cleared: r.cleared, claimed: r.claimed, bonusScore: r.bonusScore ?? 5 })),
    clearedCount: rooms.filter((r) => r.cleared).length,
    bossCleared: rooms[6]?.claimed ?? false,
    voicesMessageThreshold: 15,
  };
}

describe('CampaignScreen — the cave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('draws seven caverns in order, numbered I through VII', () => {
    // Three cleared and claimed, the fourth current, the rest still sealed doors.
    mockCampaign = campaignOf([
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
    ]);
    const { toJSON } = render(<CampaignScreen />);
    const drawn = JSON.stringify(toJSON());
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const positions = numerals.map((n) => drawn.indexOf(`"${n}"`));
    expect(positions.every((p) => p > -1)).toBe(true);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('forges exactly one claim button — the first claimable room — and inks the rest', () => {
    // gate and runes are both cleared and unclaimed; gate comes first in list order so it gets
    // the forge, and runes gets ink even though it is claimable too.
    mockCampaign = campaignOf([
      { cleared: true, claimed: false, bonusScore: 5 },
      { cleared: true, claimed: true },
      { cleared: true, claimed: false, bonusScore: 8 },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
    ]);
    const { getAllByTestId, getByLabelText } = render(<CampaignScreen />);

    // Ink is the only variant that draws its underline — one of these means one non-forged claim.
    expect(getAllByTestId('ink-underline')).toHaveLength(1);
    // Both claimable rows are present and carry their full row context in the label.
    expect(getByLabelText('I. The Meeting Cave. Claim +5')).toBeTruthy();
    expect(getByLabelText('III. The Rune Chamber. Claim +8')).toBeTruthy();
  });

  it('shows the dragon sleeping, not "sealed", while the boss is locked', () => {
    // The first five caverns are cleared; the sixth (the bridge) is still the current room, so
    // the seventh (the dragon's threshold) is locked rather than current.
    mockCampaign = campaignOf([
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: true, claimed: true },
      { cleared: false, claimed: false },
      { cleared: false, claimed: false },
    ]);
    const { getByText, queryByText, getByLabelText } = render(<CampaignScreen />);

    expect(getByText('It sleeps until the sixth cavern is cleared.')).toBeTruthy();
    // The dragon's line replaces the plain sealed suffix, not adds to it.
    expect(queryByText(/· sealed/)).toBeNull();
    expect(
      getByLabelText("VII. The Dragon's Threshold. It sleeps until the sixth cavern is cleared."),
    ).toBeTruthy();
  });
});
