import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TownSquareRoundScreen from '../[sessionId]';
import { useTownSquareRound } from '../../../hooks/useTownSquareRound';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessionId: 's1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn() }),
}));

// The hook module pulls in lib/supabase, which builds a real client at import time.
jest.mock('../../../lib/supabase', () => ({
  supabase: { channel: jest.fn(), removeChannel: jest.fn() },
}));
jest.mock('../../../hooks/useTownSquareRound');
jest.mock('../../../components/video/AgoraVideoCall', () => ({ AgoraVideoCall: () => null }));

const mockUseRound = useTownSquareRound as jest.Mock;

const round = {
  pairingId: 'p1',
  videoToken: 'tok',
  channelName: 'chan',
  appId: 'app',
  icebreakerText: 'Favorite trip?',
  roundNumber: 1,
  roundEndsAt: new Date(Date.now() + 120_000).toISOString(),
};

function stubRound(overrides: Record<string, unknown> = {}) {
  const stub = {
    round,
    isLoading: false,
    error: null,
    markJoined: jest.fn(),
    submitResponse: jest.fn(),
    hasResponded: false,
    matchId: null,
    isResponding: false,
    respondError: false,
    clearRespondError: jest.fn(),
    joinError: false,
    clearJoinError: jest.fn(),
    ...overrides,
  };
  mockUseRound.mockReturnValue(stub);
  return stub;
}

// VideoControls reads the safe-area insets, so the screen needs a provider with fixed metrics.
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TownSquareRoundScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => jest.clearAllMocks());

describe('TownSquareRoundScreen — join failure', () => {
  // The hook has always reported joinError; no screen ever read it, so a failed join was
  // silent and the round's attendance went unrecorded with the user none the wiser.
  it('says nothing about joining while the join is succeeding', () => {
    stubRound();
    const { queryByText } = renderScreen();
    expect(queryByText("Couldn't Join the Round")).toBeNull();
  });

  it('tells the user when the join failed', () => {
    stubRound({ joinError: true });
    const { getByText } = renderScreen();
    expect(getByText("Couldn't Join the Round")).toBeTruthy();
    expect(getByText('Your attendance for this round was not recorded.')).toBeTruthy();
  });

  it('retries the join for the current pairing and clears the error', () => {
    const stub = stubRound({ joinError: true });
    const { getByText } = renderScreen();

    fireEvent.press(getByText('RETRY'));

    expect(stub.clearJoinError).toHaveBeenCalled();
    expect(stub.markJoined).toHaveBeenCalledWith('p1');
  });

  it('lets the user dismiss the failure without retrying', () => {
    const stub = stubRound({ joinError: true });
    const { getByText } = renderScreen();

    fireEvent.press(getByText('CANCEL'));

    expect(stub.clearJoinError).toHaveBeenCalled();
    expect(stub.markJoined).not.toHaveBeenCalled();
  });
});
