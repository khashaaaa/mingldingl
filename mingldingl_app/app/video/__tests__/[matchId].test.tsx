import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TamaguiProvider } from 'tamagui';
import VideoScreen from '../[matchId]';
import { apiClient } from '../../../lib/api/apiClient';
import { queryKeys } from '../../../lib/api/queryKeys';
import tamaguiConfig from '../../../tamagui.config';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock('../../../hooks/useVideoCall', () => ({
  useVideoCall: () => ({
    token: { token: 't', channelName: 'c', appId: 'a' },
    loading: false,
    error: null,
    muted: false,
    setMuted: jest.fn(),
    cameraOff: false,
    setCameraOff: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useMatches', () => ({
  useMatches: () => ({ data: undefined }),
}));

jest.mock('../../../hooks/useOptimisticScoreBump', () => ({
  useOptimisticScoreBump: () => jest.fn(),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: { setPendingDrop: () => void }) => unknown) =>
    selector({ setPendingDrop: jest.fn() }),
}));

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { video: { complete: jest.fn() } },
}));

jest.mock('../../../components/video/AgoraVideoCall', () => ({
  AgoraVideoCall: () => null,
}));

jest.mock('../../../components/video/VideoControls', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    VideoControls: ({ onEnd }: { onEnd: () => void }) => (
      <TouchableOpacity onPress={onEnd}>
        <Text>End Call</Text>
      </TouchableOpacity>
    ),
  };
});

const mockComplete = apiClient.video.complete as jest.Mock;

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

  const view = render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <VideoScreen />
      </QueryClientProvider>
    </TamaguiProvider>,
  );
  return { ...view, invalidateSpy };
}

/** Hanging up now asks for confirmation first, so every end goes through the dialog. */
async function endCall(view: ReturnType<typeof renderWithClient>) {
  fireEvent.press(view.getByText('End Call'));
  await waitFor(() => view.getByText(/End the Rite\?/i));
  fireEvent.press(view.getByText(/^END THE CALL$/i));
}

describe('VideoScreen handleEnd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates the matches cache on end, even when nothing was awarded', async () => {
    mockComplete.mockResolvedValue({ awarded: 0, droppedItem: null });
    const view = renderWithClient();

    await endCall(view);

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(view.invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
  });

  it('still invalidates the matches cache when an award was granted', async () => {
    mockComplete.mockResolvedValue({ awarded: 25, droppedItem: null });
    const view = renderWithClient();

    await endCall(view);

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(view.invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.matches });
  });

  it('asks before ending, and does not complete the call if the user backs out', async () => {
    mockComplete.mockResolvedValue({ awarded: 0, droppedItem: null });
    const { getByText } = renderWithClient();

    fireEvent.press(getByText('End Call'));
    await waitFor(() => getByText(/End the Rite\?/i));
    fireEvent.press(getByText(/^CANCEL$/i));

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('completes only once when the confirm is double-tapped', async () => {
    let resolve!: (v: unknown) => void;
    mockComplete.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { getByText } = renderWithClient();

    fireEvent.press(getByText('End Call'));
    await waitFor(() => getByText(/End the Rite\?/i));
    const confirm = getByText(/^END THE CALL$/i);
    fireEvent.press(confirm);
    fireEvent.press(confirm);

    expect(mockComplete).toHaveBeenCalledTimes(1);
    resolve({ awarded: 0, droppedItem: null });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
