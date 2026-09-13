import { render } from '@testing-library/react-native';
import MatchesScreen from '../matches';
import { useMatches } from '../../../hooks/useMatches';
import { useMyUserId } from '../../../hooks/useMyUserId';
import { useScoreDetail } from '../../../hooks/useScoreDetail';
import { useTownSquareSession } from '../../../hooks/useTownSquareSession';
import { WithSafeArea } from '../../../lib/testing/safeArea';
import type { Match } from '../../../models/match';

jest.mock('expo-router', () => ({ usePathname: () => '/test', useRouter: () => ({ push: jest.fn() }) }));

// Each hook is stubbed directly rather than wrapped in a QueryClientProvider — the same choice
// `profile.test.tsx` makes — since this test cares only about the footer QuestTile's own list
// renders, not the score HUD. `useTownSquareSession` is stubbed with a live gathering so that the
// pill's absence below is a real absence rather than the pill hiding itself for want of a session.
jest.mock('../../../hooks/useMatches');
jest.mock('../../../hooks/useMyUserId');
jest.mock('../../../hooks/useScoreDetail');
jest.mock('../../../hooks/useTownSquareSession', () => ({ useTownSquareSession: jest.fn() }));

const mockUseMatches = useMatches as jest.Mock;
const mockUseMyUserId = useMyUserId as jest.Mock;
const mockUseScoreDetail = useScoreDetail as jest.Mock;
const mockUseTownSquareSession = useTownSquareSession as jest.Mock;

const BASE_MATCH: Match = {
  matchId: 'm1',
  otherUserId: 'u2',
  status: 'Active',
  revealLevel: 2,
  messageCount: 0,
  icebreakerComplete: false,
  videoCallUnlocked: false,
  otherUser: { displayName: 'Riley' },
  flameRiteDurationMinutes: 5,
  flameRiteRequired: false,
  videoEnabled: true,
};

function renderScreen() {
  return render(
    <WithSafeArea>
      <MatchesScreen />
    </WithSafeArea>,
  );
}

beforeEach(() => {
  mockUseMyUserId.mockReturnValue('me');
  mockUseScoreDetail.mockReturnValue({ data: undefined });
  mockUseTownSquareSession.mockReturnValue({
    session: {
      sessionId: 's1',
      status: 'Open',
      rsvpOpensAt: new Date(2026, 8, 13, 9).toISOString(),
      rsvpClosesAt: new Date(2026, 8, 13, 20).toISOString(),
      scheduledStartAt: new Date(2026, 8, 13, 21).toISOString(),
      isRsvpd: false,
      rsvpCount: 3,
      roundCount: 4,
    },
    isLoading: false,
  });
  mockUseMatches.mockReturnValue({
    data: [BASE_MATCH],
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  });
});

describe('MatchesScreen', () => {
  it('speaks the law under the list of fires', () => {
    const { getByText } = renderScreen();
    expect(
      getByText("A fire is judged at dawn. Whoever's turn it was when it froze is the one who let it."),
    ).toBeTruthy();
  });

  it('no longer carries the next gathering — that pill lives on the hearth now', () => {
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });

  it('says nothing about the law on the empty state', () => {
    mockUseMatches.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    const { queryByText } = renderScreen();
    expect(
      queryByText("A fire is judged at dawn. Whoever's turn it was when it froze is the one who let it."),
    ).toBeNull();
  });
});
