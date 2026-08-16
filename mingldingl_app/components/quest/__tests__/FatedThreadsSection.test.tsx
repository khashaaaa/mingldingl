import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FatedThreadsSection } from '../FatedThreadsSection';
import { apiClient } from '../../../lib/api/apiClient';

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { ships: { pending: jest.fn(), respond: jest.fn() } },
}));

const mockPending = apiClient.ships.pending as jest.Mock;
const mockRespond = apiClient.ships.respond as jest.Mock;

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FatedThreadsSection />
    </QueryClientProvider>,
  );
}

describe('FatedThreadsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when there are no pending threads', async () => {
    mockPending.mockResolvedValue([]);
    const { queryByText } = renderWithClient();
    await waitFor(() => expect(mockPending).toHaveBeenCalled());
    expect(queryByText(/Fated Threads/i)).toBeNull();
  });

  it('renders a prompt per pending thread, naming only the Weaver', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    const { findByText } = renderWithClient();
    expect(await findByText(/Bataar/)).toBeTruthy();
  });

  it('tapping Find Out calls respond with accept=true', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    mockRespond.mockResolvedValue({ sparked: false });
    const { findByText } = renderWithClient();
    await findByText(/Bataar/);

    fireEvent.press(await findByText('Find Out'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('s1', true));
  });

  it('tapping Not Now calls respond with accept=false', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    mockRespond.mockResolvedValue({ sparked: false });
    const { findByText } = renderWithClient();
    await findByText(/Bataar/);

    fireEvent.press(await findByText('Not Now'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('s1', false));
  });
});
