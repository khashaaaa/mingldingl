import { fireEvent, render } from '@testing-library/react-native';
import SatchelScreen from '../satchel';
import { useProfile } from '../../hooks/useProfile';
import { useMatches } from '../../hooks/useMatches';
import { useDailyMatchBudget } from '../../hooks/useScore';
import { usePendingShips } from '../../hooks/usePendingShips';
import { useTownSquareSession } from '../../hooks/useTownSquareSession';
import { useMembership } from '../../hooks/useMembership';
import { useInventory } from '../../hooks/useInventory';
import { useRevealLadder } from '../../hooks/useRevealThresholds';
import { WithSafeArea } from '../../lib/testing/safeArea';
import type { Match } from '../../models/match';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ usePathname: () => '/satchel', useRouter: () => ({ push: mockPush }) }));

jest.mock('../../hooks/useProfile');
jest.mock('../../hooks/useMatches');
jest.mock('../../hooks/useScore');
jest.mock('../../hooks/usePendingShips');
jest.mock('../../hooks/useTownSquareSession', () => ({ useTownSquareSession: jest.fn() }));
jest.mock('../../hooks/useMembership');
jest.mock('../../hooks/useInventory');
jest.mock('../../hooks/useRevealThresholds', () => ({ useRevealLadder: jest.fn() }));

const mockUseProfile = useProfile as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseDailyMatchBudget = useDailyMatchBudget as jest.Mock;
const mockUsePendingShips = usePendingShips as jest.Mock;
const mockUseTownSquareSession = useTownSquareSession as jest.Mock;
const mockUseMembership = useMembership as jest.Mock;
const mockUseInventory = useInventory as jest.Mock;
const mockUseRevealLadder = useRevealLadder as jest.Mock;

function activeMatch(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'm1',
    otherUserId: 'o1',
    status: 'Active',
    revealLevel: 1,
    messageCount: 3,
    icebreakerComplete: true,
    videoCallUnlocked: false,
    otherUser: {},
    flameRiteDurationMinutes: 5,
    flameRiteRequired: true,
    videoEnabled: true,
    ...overrides,
  };
}

function renderScreen() {
  return render(<SatchelScreen />, { wrapper: WithSafeArea });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDailyMatchBudget.mockReturnValue({ budget: 5, used: 2, remaining: 3 });
  mockUsePendingShips.mockReturnValue({ pendingShips: [{ shipId: 's1' }, { shipId: 's2' }] });
  mockUseTownSquareSession.mockReturnValue({
    session: { sessionId: 'sess1', status: 'Open', isRsvpd: true, rsvpOpensAt: null, rsvpClosesAt: null, scheduledStartAt: null, rsvpCount: 1, roundCount: 3 },
  });
  mockUseMembership.mockReturnValue({ currentLevel: 'Silver' });
  mockUseInventory.mockReturnValue({ items: [{ itemId: 'title_oathkeeper', itemType: 'Title', equipped: true }] });
  // Matches `lib/reveal.ts`'s `DEFAULT_LADDER`, so switching the screen from a one-off
  // `revealLadderSnapshot()` read to the live `useRevealLadder()` hook changes nothing these
  // existing rows already assert.
  mockUseRevealLadder.mockReturnValue([1, 5, 15, 30]);
  mockUseProfile.mockReturnValue({
    data: {
      oath: 'Bond',
      oathProven: false,
      oathEncountersHeld: 2,
      oathEncountersNeeded: 5,
      referralCode: 'ABC123',
      membershipLevel: 'Silver',
    },
    isLoading: false,
  });
  mockUseMatches.mockReturnValue({
    data: [activeMatch({ matchId: 'm1', revealLevel: 1 }), activeMatch({ matchId: 'm2', revealLevel: 2 })],
    isLoading: false,
  });
});

describe('the Satchel, full', () => {
  it('states the room and what it holds', () => {
    const { getByText } = renderScreen();
    expect(getByText('The Satchel')).toBeTruthy();
    expect(getByText(/What you carry tonight/)).toBeTruthy();
    expect(getByText(/Nothing here can be bought, found or stacked/)).toBeTruthy();
  });

  it('counts the candles left against the day’s wax', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Candles. 3 of 5 left')).toBeTruthy();
  });

  it('names the arrows still awaiting an answer, worded past one', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Arrows. two await your answer')).toBeTruthy();
  });

  it('shows the lantern lit once the next gathering is answered for', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Lantern. Lit for the next gathering')).toBeTruthy();
  });

  it('states the oath and its progress while unproven', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Oath sigil. A Bond · 2 of 5 kept')).toBeTruthy();
  });

  it('names the oath as proven once it is, instead of counting toward it', () => {
    mockUseProfile.mockReturnValue({
      data: { oath: 'Bond', oathProven: true, oathEncountersHeld: 5, oathEncountersNeeded: 5, referralCode: 'ABC123', membershipLevel: 'Silver' },
      isLoading: false,
    });
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Oath sigil. A Bond · proven')).toBeTruthy();
  });

  // Regression: a sworn, unproven oath with no encounter tally yet (both counts null, not 0 —
  // the engine has simply not sent them) used to default both to 0 and print "0 of 5 kept",
  // reading as fulfilled. `OathCard.tsx`/`useHonourProgress.ts` both refuse a count in this case;
  // the Satchel must too.
  it('names a sworn oath alone when its encounter counts are not yet known, never "0 of"', () => {
    mockUseProfile.mockReturnValue({
      data: { oath: 'Bond', oathProven: false, oathEncountersHeld: null, oathEncountersNeeded: null, referralCode: 'ABC123', membershipLevel: 'Silver' },
      isLoading: false,
    });
    // The exact label is itself the assertion that neither "0 of" nor "kept" leaked in — the row's
    // whole fact lives in this one string (`SatchelRow`'s accessibility contract), so any stray
    // progress suffix would already make this not match.
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Oath sigil. A Bond · sworn')).toBeTruthy();
  });

  it('holds the key at Silver, naming the floor it opens', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('The key. Held · The Hall')).toBeTruthy();
  });

  it("carries the ally's word as the code itself", () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText("Ally's word. ABC123")).toBeTruthy();
  });

  it('names the worn honour by its equipped item', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Worn honour. Oath-Keeper')).toBeTruthy();
  });

  it('sums the unbroken seals across every active thread', () => {
    // ladder length 4 (default), revealLevel 1 and 2 -> 3 + 2 = 5 seals across two threads.
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Seals held. five unbroken on you, across two threads')).toBeTruthy();
  });

  // Regression for reading `useRevealLadder()` rather than a one-off `revealLadderSnapshot()`
  // call: the seals count must track whatever the *hook* currently reports, not a value read once
  // at import time — this is the only way to observe that distinction, since `lib/reveal.ts` fixes
  // the ladder at exactly four levels and a same-length hydration event would look identical
  // either way.
  it("reads the seals count off the ladder the hook reports, not a frozen one", () => {
    mockUseRevealLadder.mockReturnValue([1, 5, 15, 30, 45, 60]);
    // length 6, revealLevel 1 and 2 -> 5 + 4 = 9 seals across two threads.
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Seals held. nine unbroken on you, across two threads')).toBeTruthy();
  });

  it('states the card the same way regardless of who holds it', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Your card. Wanted, honestly kept')).toBeTruthy();
  });

  it('summarises the first three rows in italic, joined', () => {
    const { getByText } = renderScreen();
    expect(getByText('three candles. two arrows. Your lantern is lit.')).toBeTruthy();
  });

  it('goes to the room a held object is used in when tapped', () => {
    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('The key. Held · The Hall'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });
});

describe('the Satchel, empty', () => {
  beforeEach(() => {
    mockUseDailyMatchBudget.mockReturnValue({ budget: 3, used: 3, remaining: 0 });
    mockUsePendingShips.mockReturnValue({ pendingShips: [] });
    mockUseTownSquareSession.mockReturnValue({ session: null });
    mockUseMembership.mockReturnValue({ currentLevel: 'Free' });
    mockUseInventory.mockReturnValue({ items: [] });
    mockUseProfile.mockReturnValue({
      data: {
        oath: null,
        oathProven: false,
        oathEncountersHeld: null,
        oathEncountersNeeded: null,
        referralCode: null,
        membershipLevel: 'Free',
      },
      isLoading: false,
    });
    mockUseMatches.mockReturnValue({ data: [], isLoading: false });
  });

  it('states none in flight, no gathering, no oath, no key, no word, no honour, no thread', () => {
    const { getByLabelText } = renderScreen();
    expect(getByLabelText('Arrows. None in flight')).toBeTruthy();
    expect(getByLabelText('Lantern. No gathering called')).toBeTruthy();
    expect(getByLabelText('Oath sigil. No oath sworn')).toBeTruthy();
    expect(getByLabelText('The key. Not held · the Hall opens the deep seal')).toBeTruthy();
    expect(getByLabelText("Ally's word. Not yet given")).toBeTruthy();
    expect(getByLabelText('Worn honour. None worn')).toBeTruthy();
    expect(getByLabelText('Seals held. No thread open')).toBeTruthy();
  });

  it('never asserts "no" for a row while its data is still loading', () => {
    mockUseProfile.mockReturnValue({ data: undefined, isLoading: true });
    const { getByTestId, queryByLabelText } = renderScreen();
    expect(getByTestId('skeleton-rows')).toBeTruthy();
    expect(queryByLabelText('Oath sigil. No oath sworn')).toBeNull();
  });
});
