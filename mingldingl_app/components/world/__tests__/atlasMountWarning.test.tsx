import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiscoverScreen from '../../../app/(tabs)/discover';
import { WorldProvider } from '../WorldProvider';
import { WithSafeArea } from '../../../lib/testing/safeArea';
import { apiClient } from '../../../lib/api/apiClient';

/**
 * Regression guard for a backlog entry claiming React logs "Cannot update a component
 * (`AtlasOverlay`) while rendering a different component (`DiscoverScreen`)" on every Discover
 * mount. `AtlasOverlay`'s only state write (`setGrid`) lives inside its grid's `onLayout`, and
 * `AtlasSigil`'s only write lives inside `onPress` — both are legal event-handler writes, not
 * render-time ones. `WorldProvider`, the other suspect, writes `light.value`/`setNow` only inside
 * `useEffect`. This mounts the real Discover + world tree (the same composition `app/_layout.tsx`
 * builds) and asserts React never logs that warning — if this ever starts failing, that is the
 * regression to chase, not this test.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useSegments: () => ['(tabs)', 'discover'],
  useGlobalSearchParams: () => ({}),
}));

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: {
    matches: { candidates: jest.fn() },
    scores: { me: jest.fn() },
  },
}));

const mockCandidates = apiClient.matches.candidates as jest.Mock;
const mockScore = apiClient.scores.me as jest.Mock;

function pending() {
  return new Promise(() => {});
}

beforeEach(() => {
  mockCandidates.mockReset().mockImplementation(pending);
  mockScore.mockReset().mockImplementation(pending);
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <WithSafeArea>
      <QueryClientProvider client={client}>
        <WorldProvider>
          <DiscoverScreen />
        </WorldProvider>
      </QueryClientProvider>
    </WithSafeArea>,
  );
}

describe('Discover mount', () => {
  it('never logs a setState-during-render warning for AtlasOverlay', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderScreen();
    const offenders = spy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('Cannot update a component'),
    );
    spy.mockRestore();
    expect(offenders).toEqual([]);
  });
});

describe('Discover chrome (task 8: moved off Seek)', () => {
  // The three chrome strips (First Steps, the summons budget meter, the gathering pill) used to
  // sit above the candidate deck. GettingStartedCard and DailyBudgetMeter moved to the Character
  // sheet, NextGatheringPill to the Town Square tab — Discover keeps only its header and the deck.
  it('renders the loaded deck without the getting-started card, budget meter, or gathering pill', async () => {
    mockCandidates.mockResolvedValueOnce({
      items: [{ id: 'c1', displayName: 'Amara', age: 28, photoUrls: ['c1.jpg'] }],
      page: 1,
      hasMore: false,
    });
    mockScore.mockResolvedValueOnce({ dailyMatchBudget: 5, dailyMatchesUsed: 2, dailyMatchesRemaining: 3 });

    const { findByText, queryByText, queryByTestId } = renderScreen();
    await waitFor(() => expect(findByText('Amara, 28')).resolves.toBeTruthy());

    // CardEyebrow uppercases its own children — this is the literal rendered text, not a style.
    expect(queryByText('FIRST STEPS')).toBeNull();
    expect(queryByTestId('daily-budget-meter')).toBeNull();
    expect(queryByTestId('next-gathering-pill')).toBeNull();
  });
});
