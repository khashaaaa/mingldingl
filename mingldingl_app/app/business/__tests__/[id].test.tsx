import { render } from '@testing-library/react-native';
import BusinessDetailScreen from '../[id]';
import { useBusiness } from '../../../hooks/useBusiness';
import { useBusinessReviews } from '../../../hooks/useBusinessReviews';
import { WithSafeArea } from '../../../lib/testing/safeArea';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../../hooks/useBusiness');
jest.mock('../../../hooks/useBusinessReviews');

const mockUseBusiness = useBusiness as jest.Mock;
const mockUseReviews = useBusinessReviews as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseReviews.mockReturnValue({ reviews: [], isLoading: false });
});

describe('BusinessDetailScreen reached without navigation params', () => {
  // A deep link, a shared URL, a browser reload or a restored session arrives with nothing but an
  // id. The screen used to paint its shell anyway — a blank title bar, a placeholder band and a
  // fabricated "0.0 (0)" — while the fetch ran, and kept it forever if the venue was gone.
  it('waits rather than showing a fabricated rating', () => {
    mockParams = { id: 'b1' };
    mockUseBusiness.mockReturnValue({ business: undefined, isLoading: true, isError: false });

    const { queryByText } = render(<BusinessDetailScreen />, { wrapper: WithSafeArea });
    expect(queryByText('0.0 (0)')).toBeNull();
  });

  it('says the venue is gone rather than showing an empty shell', () => {
    mockParams = { id: 'b1' };
    mockUseBusiness.mockReturnValue({ business: undefined, isLoading: false, isError: true });

    const { getByText, queryByText } = render(<BusinessDetailScreen />, { wrapper: WithSafeArea });
    expect(getByText('This Place Is Gone')).toBeTruthy();
    expect(queryByText('0.0 (0)')).toBeNull();
  });

  it('paints instantly from the Mission Board params, without waiting on the fetch', () => {
    mockParams = { id: 'b1', name: 'Cafe Amber', averageRating: '4.5', ratingCount: '12' };
    mockUseBusiness.mockReturnValue({ business: undefined, isLoading: true, isError: false });

    const { getByText } = render(<BusinessDetailScreen />, { wrapper: WithSafeArea });
    expect(getByText('Cafe Amber')).toBeTruthy();
    expect(getByText('4.5 (12)')).toBeTruthy();
  });
});
