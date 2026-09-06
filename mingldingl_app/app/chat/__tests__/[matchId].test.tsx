import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatScreen from '../[matchId]';
import { WithSafeArea } from '../../../lib/testing/safeArea';


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

jest.mock('../../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [], loading: false, isError: false, refetch: jest.fn(),
    sendMessage: jest.fn(), retryMessage: jest.fn(), myId: 'me1',
    loadEarlier: jest.fn(), hasMore: false, loadingEarlier: false,
    earlierError: false, justLoadedEarlier: false, acknowledgeEarlierLoaded: jest.fn(),
  }),
}));

let mockAttendanceDue = false;
jest.mock('../../../hooks/useAttendanceCheck', () => ({
  useAttendanceCheck: () => ({
    due: mockAttendanceDue, activityTitle: 'Coffee', submit: jest.fn(),
    isSubmitting: false, submitFailed: false, clearSubmitFailed: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useMatches', () => ({
  useMatches: () => ({
    data: [{
      matchId: 'm1', otherUserId: 'u2', status: 'Active', revealLevel: 2, messageCount: 7,
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

describe('ChatScreen', () => {
  beforeEach(() => {
    mockEndedReason = null;
    mockAttendanceDue = false;
    mockPush.mockClear();
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
    expect(getByText('Plan an Encounter')).toBeTruthy();
  });

  it('opens the reveal strip collapsed, with the progress line still showing', () => {
    const { queryByTestId, getByText } = renderScreen();

    expect(getByText('Next reveal at 15 messages')).toBeTruthy();
    expect(queryByTestId('reveal-photo-locked-0')).toBeNull();
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
    expect(getByText('This bond has been severed — you can no longer send messages.')).toBeTruthy();
  });
});
