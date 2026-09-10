import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiscoverScreen from '../../../app/(tabs)/discover';
import { WorldProvider } from '../WorldProvider';
import { WithSafeArea } from '../../../lib/testing/safeArea';

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

// Pulls in Supabase realtime wiring that needs env config this test has no reason to provide;
// irrelevant to the atlas/world tree under test.
jest.mock('../../townsquare/NextGatheringPill', () => ({
  NextGatheringPill: () => null,
}));

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: {
    matches: { candidates: jest.fn(() => new Promise(() => {})) },
    milestones: { list: jest.fn(() => new Promise(() => {})) },
    scores: { detail: jest.fn(() => new Promise(() => {})) },
    users: { me: jest.fn(() => new Promise(() => {})) },
  },
}));

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
