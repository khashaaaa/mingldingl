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
    expect(getByText('Ask')).toBeTruthy();
  });

  it('waits when I proposed, with the candle beside it', () => {
    const { getByText, getByTestId } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: ME, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId={ME} />);
    expect(getByText('You have asked. A candle until they answer.')).toBeTruthy();
    expect(getByTestId('waiting-candle')).toBeTruthy();
  });

  it('offers accept and decline when they proposed, with exactly one forged button', () => {
    const { getByText, getAllByTestId } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: THEM, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId={ME} />);
    expect(getByText('They have asked for it.')).toBeTruthy();
    expect(getByText('Not yet')).toBeTruthy();
    // The forged accept button renders its label in caps; ink buttons keep sentence case and
    // draw the underline mark — exactly one of the two buttons is ink, so exactly one is metal.
    expect(getByText('ACCEPT')).toBeTruthy();
    expect(getAllByTestId('ink-underline').length).toBe(1);
  });

  it('offers to step in once accepted', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard
        state={{ ...base, proposedByUserId: THEM, proposedAt: '2026-08-19T10:00:00Z', acceptedAt: '2026-08-19T10:01:00Z' }}
        currentUserId={ME}
      />);
    expect(getByText('The rite is open. Step in when you are both ready.')).toBeTruthy();
    expect(getByText('Step in')).toBeTruthy();
  });

  it('shows the flame glyph and the sub-line once complete', () => {
    const { getByText, getByTestId } = renderWithClient(
      <FlameRiteCard state={{ ...base, completedAt: '2026-08-19T10:09:00Z' }} currentUserId={ME} />);
    expect(getByText('Flame-tested')).toBeTruthy();
    expect(getByText('Two faces met across the glass. The seal on the likeness is gone for good.')).toBeTruthy();
    expect(getByTestId('glyph-flame', { includeHiddenElements: true })).toBeTruthy();
  });

  it('navigates to the video screen when the step-in CTA is pressed in the accepted state', () => {
    const { getByText } = renderWithClient(
      <FlameRiteCard
        state={{ ...base, proposedByUserId: THEM, proposedAt: '2026-08-19T10:00:00Z', acceptedAt: '2026-08-19T10:01:00Z' }}
        currentUserId={ME}
      />);

    fireEvent.press(getByText('Step in'));

    expect(mockPush).toHaveBeenCalledWith('/video/m1');
  });

  it('shows the action-failed alert when a rite action fails', async () => {
    mockRitePropose.mockRejectedValue(new Error('network down'));
    const { getByText } = renderWithClient(<FlameRiteCard state={base} currentUserId={ME} />);

    fireEvent.press(getByText('Ask'));

    await waitFor(() => expect(getByText('The Attempt Faltered')).toBeTruthy());
  });

  it('renders nothing when currentUserId is empty', () => {
    const { toJSON } = renderWithClient(
      <FlameRiteCard state={{ ...base, proposedByUserId: ME, proposedAt: '2026-08-19T10:00:00Z' }} currentUserId="" />);
    expect(toJSON()).toBeNull();
  });
});
