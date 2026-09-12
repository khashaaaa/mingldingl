import { act, render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatScreen from '../[matchId]';
import { WithSafeArea } from '../../../lib/testing/safeArea';
import { FONTS } from '../../../lib/theme';


const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1', name: 'Riley' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

let mockEndedReason: string | null = null;
jest.mock('../../../hooks/useMatchStatus', () => ({
  useMatchStatus: () => ({ status: 'Active', endedReason: mockEndedReason, reset: jest.fn() }),
}));

type MockMessage = { id: string; matchId: string; senderId: string; content: string; createdAt: string; status: 'sent' };
let mockMessages: MockMessage[] = [];
let mockHasMore = false;
jest.mock('../../../hooks/useChat', () => ({
  useChat: () => ({
    messages: mockMessages, loading: false, isError: false, refetch: jest.fn(),
    sendMessage: jest.fn(), retryMessage: jest.fn(), myId: 'me1',
    loadEarlier: jest.fn(), hasMore: mockHasMore, loadingEarlier: false,
    earlierError: false, justLoadedEarlier: false, acknowledgeEarlierLoaded: jest.fn(),
  }),
}));

let mockAttendanceDue = false;
/** The engine's mutual count; the activity gate defaults to 15 of them. */
let mockMatchMessageCount = 7;
jest.mock('../../../hooks/useAttendanceCheck', () => ({
  useAttendanceCheck: () => ({
    due: mockAttendanceDue, activityTitle: 'Coffee', submit: jest.fn(),
    isSubmitting: false, submitFailed: false, clearSubmitFailed: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useMatches', () => ({
  useMatches: () => ({
    data: [{
      matchId: 'm1', otherUserId: 'u2', status: 'Active', revealLevel: 2, messageCount: mockMatchMessageCount,
      createdAt: '2026-09-10T12:00:00Z',
      icebreakerComplete: false, videoCallUnlocked: false, otherUser: { displayName: 'Riley' },
      flameRiteDurationMinutes: 5, flameRiteRequired: false, videoEnabled: true,
    }],
  }),
}));

jest.mock('../../../hooks/useCampaign', () => ({ useCampaign: () => ({ campaign: null }) }));

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { matches: { unmatch: jest.fn(), block: jest.fn() } },
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <WithSafeArea>
      <QueryClientProvider client={client}><ChatScreen /></QueryClientProvider>
    </WithSafeArea>,
  );
}

/**
 * The ledger's own copy, so an assertion below reads as the line on screen rather than a key.
 * `SEAL_BROKE_2` is `seal_broke_2`, which the second rung of the default ladder ([1, 5, 15, 30])
 * lands on.
 */
const FIRST_DAY = 'THE FIRST DAY';
const SEAL_BROKE_2 = 'A seal broke here. Their age and second likeness are yours now.';

/**
 * Six letters, theirs first, all inside one local day whatever the machine's zone: they span five
 * minutes, and the thread starts on the first of them, so no offset can push one onto another day
 * or the ledger onto its second. Alternating is what earns the second seal on the fifth letter —
 * the mutual count runs one ahead of the quieter side, so five letters make a mutual five.
 */
function alternatingThread(count: number): MockMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg${i + 1}`,
    matchId: 'm1',
    senderId: i % 2 === 0 ? 'u2' : 'me1',
    content: `line ${i + 1}`,
    createdAt: `2026-09-10T12:0${i}:00Z`,
    status: 'sent' as const,
  }));
}

/** Every string the tree draws, in the order it draws them. */
function drawnText(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(drawnText);
  // Stringifying the tree instead would be shorter, but a rendered node's props carry a context
  // Provider that closes a circle on itself.
  if (node && typeof node === 'object' && 'children' in node) {
    return drawnText((node as { children?: unknown }).children);
  }
  return [];
}

/** Where each piece of copy sits in the rendered tree, so "above" and "below" can be asserted. */
function positions(tree: unknown, ...texts: string[]): number[] {
  const drawn = drawnText(tree);
  return texts.map((t) => drawn.findIndex((line) => line.includes(t)));
}

describe('ChatScreen', () => {
  beforeEach(() => {
    mockEndedReason = null;
    mockAttendanceDue = false;
    mockMatchMessageCount = 7;
    mockMessages = [];
    mockHasMore = false;
    mockPush.mockClear();
  });

  it('opens the thread with the day it began', () => {
    mockMessages = alternatingThread(6);
    const { toJSON } = renderScreen();

    const [heading, first] = positions(toJSON(), FIRST_DAY, 'line 1');
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(first);
  });

  it('marks where the second seal broke, between the letter that broke it and the next', () => {
    mockMessages = alternatingThread(6);
    const { toJSON } = renderScreen();

    const [fifth, seal, sixth] = positions(toJSON(), 'line 5', SEAL_BROKE_2, 'line 6');
    expect(seal).toBeGreaterThan(fifth);
    expect(seal).toBeLessThan(sixth);
  });

  it('marks no seal at all while earlier letters are still unloaded', () => {
    // The count that breaks a seal is the whole history's, and a page that begins mid-conversation
    // cannot know how many letters came before it.
    mockMessages = alternatingThread(6);
    mockHasMore = true;
    const { getByText, queryByText } = renderScreen();

    // The same six letters that earn the row above still draw; only the mark is withheld.
    expect(getByText('line 5')).toBeTruthy();
    expect(queryByText(SEAL_BROKE_2)).toBeNull();
  });

  it('sets my own letters in the app\'s italic and theirs in their own hand', () => {
    mockMessages = alternatingThread(6);
    const { getByText } = renderScreen();

    expect(StyleSheet.flatten(getByText('line 2').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.bodyItalic }),
    );
    expect(StyleSheet.flatten(getByText('line 1').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.body }),
    );
  });

  it('renders a lone incoming first word as a sealed letter, and the line once opened', () => {
    jest.useFakeTimers();
    mockMessages = [{ id: 'msg1', matchId: 'm1', senderId: 'u2', content: 'Сайн уу', createdAt: '2026-09-10T10:00:00Z', status: 'sent' }];
    const { getByTestId, queryByText, getByText, queryByTestId } = renderScreen();

    expect(getByTestId('sealed-letter')).toBeTruthy();
    expect(queryByText('Сайн уу')).toBeNull();

    fireEvent.press(getByTestId('sealed-letter'));
    act(() => { jest.advanceTimersByTime(1000); });

    expect(queryByTestId('sealed-letter')).toBeNull();
    expect(getByText('Сайн уу')).toBeTruthy();
    jest.useRealTimers();
  });

  it('does not seal your own first word', () => {
    mockMessages = [{ id: 'msg1', matchId: 'm1', senderId: 'me1', content: 'Hello', createdAt: '2026-09-10T10:00:00Z', status: 'sent' }];
    const { queryByTestId, getByText } = renderScreen();

    expect(queryByTestId('sealed-letter')).toBeNull();
    expect(getByText('Hello')).toBeTruthy();
  });

  it('keeps the per-match activities behind one row instead of stacking them over the thread', () => {
    const { getByTestId, queryByText, getByText } = renderScreen();

    // Five banners above the message list is what pushed the conversation off the first screen.
    expect(queryByText('Break the Ice')).toBeNull();
    expect(queryByText('Trial of Compatibility')).toBeNull();
    expect(queryByText('Plan an Encounter')).toBeNull();
    expect(getByText('Things to do together')).toBeTruthy();

    fireEvent.press(getByTestId('chat-activities'));

    expect(getByText('Break the Ice')).toBeTruthy();
    expect(getByText('Trial of Compatibility')).toBeTruthy();
    // 7 of the 15 mutual messages the engine's gate wants, so the door is shown locked with the
    // remainder on it rather than sending you to a screen that can only say "keep chatting".
    expect(getByText('Plan an Encounter · 8 more messages')).toBeTruthy();
  });

  it('opens the encounter door once the activity gate has been met', () => {
    mockMatchMessageCount = 15;
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByTestId('chat-activities'));

    expect(getByText('Plan an Encounter')).toBeTruthy();
  });

  it('shows the seal dots and how many seals are left under the header, closed until tapped', () => {
    const { queryByTestId, getByText, getByTestId } = renderScreen();

    // revealLevel 2 has broken the first of three seals.
    expect(getByText('two seals left')).toBeTruthy();
    // The row's own children are behind its label, so the label has to carry the count too.
    expect(getByTestId('seals-toggle').props.accessibilityLabel).toBe(
      'The seals. One of three seals broken',
    );
    expect(queryByTestId('seal-photo-wax-0')).toBeNull();

    fireEvent.press(getByTestId('seals-toggle'));

    expect(getByTestId('seal-photo-wax-0')).toBeTruthy();
  });

  it('counts an attendance check as waiting on you', () => {
    mockAttendanceDue = true;
    const { getByText } = renderScreen();

    expect(getByText('1 waiting on you')).toBeTruthy();
  });

  it('hides the activities row entirely once the bond is severed', () => {
    mockEndedReason = 'ended';
    const { queryByTestId, getByText } = renderScreen();

    expect(queryByTestId('chat-activities')).toBeNull();
    expect(getByText('The bond was severed. This thread is kept as it was; no more letters can be written on it.')).toBeTruthy();
  });

  it('shows an empty state instead of a blank scroll area for a thread with no messages', () => {
    mockMessages = [];
    const { getByTestId } = renderScreen();

    expect(getByTestId('chat-empty')).toBeTruthy();
  });
});
