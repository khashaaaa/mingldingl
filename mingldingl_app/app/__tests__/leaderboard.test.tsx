import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeaderboardScreen from '../leaderboard';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../../hooks/useScrollTail', () => ({ useScrollTail: () => 0 }));

// The board is anonymous — no display names come back from the engine — so a row is a rank, a
// gem and a score. The second entry is the current user, mid-slice, the ordinary case for how
// the own row is usually found (not detached beyond TOP_SLICE_SIZE).
let mockData: {
  city: string | null;
  myRank: number;
  entries: { rank: number; gemTier: string; score: number; isCurrentUser: boolean }[];
};

jest.mock('../../hooks/useLeaderboard', () => ({
  useLeaderboard: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    isRefetching: false,
    refetch: jest.fn(),
  }),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LeaderboardScreen />
    </QueryClientProvider>,
  );
}

describe('LeaderboardScreen — the Hall of Names', () => {
  beforeEach(() => {
    mockData = {
      city: 'Ulaanbaatar',
      myRank: 2,
      entries: [
        { rank: 1, gemTier: 'Ruby', score: 1200, isCurrentUser: false },
        { rank: 2, gemTier: 'Ruby', score: 950, isCurrentUser: true },
        { rank: 3, gemTier: 'Garnet', score: 800, isCurrentUser: false },
      ],
    };
  });

  it('carves the top three ranks in Roman numerals', () => {
    const { getByText } = renderScreen();
    expect(getByText('I')).toBeTruthy();
    expect(getByText('II')).toBeTruthy();
    expect(getByText('III')).toBeTruthy();
  });

  it("marks the current user's row with her mark", () => {
    const { getByText } = renderScreen();
    expect(getByText(/your mark/i)).toBeTruthy();
  });

  it('names the city in the hall sub', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Ulaanbaatar/)).toBeTruthy();
  });

  it('reads without a dangling ". " when the engine gives no city', () => {
    mockData.city = null;
    const { queryByText, getByText } = renderScreen();
    expect(queryByText(/^\. /)).toBeNull();
    expect(getByText(/^Carved, not listed/)).toBeTruthy();
  });

  it('reads the wall to a screen reader by rank, gem and score', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('I. Ruby. 1200 points')).toBeTruthy();
    expect(getByLabelText(/^II\. Ruby\. 950 points\. /)).toBeTruthy();
  });

  it('reads the law under the wall', () => {
    const { getByText } = renderScreen();
    expect(getByText('The wall reads highest to lowest. Yours is the only torch.')).toBeTruthy();
  });

  it('renders a detached own row past 3999 without throwing', () => {
    // A real rank has no ceiling — for a big city the current user's own standing, detached past
    // TOP_SLICE_SIZE, can outrun what a Roman numeral can express. This must degrade to Arabic
    // digits, not crash renderItem (fix round 1).
    mockData.myRank = 5000;
    mockData.entries = [
      { rank: 1, gemTier: 'Ruby', score: 1200, isCurrentUser: false },
      { rank: 5000, gemTier: 'Garnet', score: 10, isCurrentUser: true },
    ];
    const { getByText } = renderScreen();
    expect(getByText('5,000')).toBeTruthy();
  });
});
