import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FlameRiteCard from '../FlameRiteCard';
import { apiClient } from '../../lib/api/apiClient';

const ME = 'user-a';
const THEM = 'user-b';
const base = { matchId: 'm1', proposedByUserId: null, proposedAt: null, acceptedAt: null, completedAt: null, durationMinutes: 5 };

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    video: {
      ritePropose: jest.fn(),
      riteAccept: jest.fn(),
      riteDecline: jest.fn(),
    },
  },
}));

const mockRitePropose = apiClient.video.ritePropose as jest.Mock;

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('FlameRiteCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the rite when nobody has proposed', () => {
    const { getByText } = renderWithClient(<FlameRiteCard state={base} currentUserId={ME} />);
    expect(getByText('Ask for the Rite')).toBeTruthy();
  });

  it('waits when I proposed', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: ME, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId={ME} />);
    expect(getByText('Waiting for them to answer')).toBeTruthy();
  });

  it('offers accept and decline when they proposed', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: THEM, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId={ME} />);
    expect(getByText('Accept')).toBeTruthy();
    expect(getByText('Not yet')).toBeTruthy();
  });

  it('shows flame-tested once complete', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard state={{ ...base, completedAt: '2026-08-19T10:09:00Z' }} currentUserId={ME} />);
    expect(getByText('Flame-tested')).toBeTruthy();
  });

  it('navigates to the video screen when the join CTA is pressed in the accepted state', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard
        state={{ ...base, proposedByUserId: THEM, proposedAt: '2026-08-19T10:00:00Z', acceptedAt: '2026-08-19T10:01:00Z' }}
        currentUserId={ME}
      />);

    fireEvent.press(getByText('Start video call'));

    expect(mockPush).toHaveBeenCalledWith('/video/m1');
  });

  it('shows the action-failed alert when a rite action fails', async () => {
    mockRitePropose.mockRejectedValue(new Error('network down'));
    const { getByText } = renderWithClient(<FlameRiteCard state={base} currentUserId={ME} />);

    fireEvent.press(getByText('Ask for the Rite'));

    await waitFor(() => expect(getByText('The Attempt Faltered')).toBeTruthy());
  });

  it('renders nothing when currentUserId is empty', () => {
    const { toJSON } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: ME, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId="" />);
    expect(toJSON()).toBeNull();
  });
});
