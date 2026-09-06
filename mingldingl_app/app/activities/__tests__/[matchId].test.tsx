import { render } from '@testing-library/react-native';
import ActivitiesScreen from '../[matchId]';
import { useActivitySuggestions } from '../../../hooks/useActivitySuggestions';
import { useMatches } from '../../../hooks/useMatches';
import { WithSafeArea } from '../../../lib/testing/safeArea';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ matchId: 'm1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('../../../hooks/useActivitySuggestions');
jest.mock('../../../hooks/useMatches');

jest.mock('../../../hooks/usePhotoUpload', () => ({
  usePhotoUpload: () => ({ pickPhoto: jest.fn(), uploadPhoto: jest.fn(), uploading: false }),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: { session: { user: { id: string } } }) => unknown) =>
    selector({ session: { user: { id: 'me' } } }),
}));

const mockUseActivitySuggestions = useActivitySuggestions as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;

const suggestion = {
  id: 's1',
  activityType: 'Coffee',
  title: 'Coffee at The Grind',
  myConfirmed: false,
  partnerConfirmed: null,
  isComplete: false,
  myRated: false,
  business: null,
};

function stubSuggestions(overrides: Partial<ReturnType<typeof useActivitySuggestions>> = {}) {
  mockUseActivitySuggestions.mockReturnValue({
    suggestions: [suggestion],
    partnerPledged: false,
    isLoading: false,
    error: null,
    confirmDate: jest.fn(),
    isConfirming: false,
    completed: null,
    rated: false,
    rateBusiness: jest.fn(),
    isRating: false,
    rateError: false,
    ...overrides,
  });
}

describe('ActivitiesScreen pledge lock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables the pledge CTA and shows pledge_locked when the rite is required and incomplete', () => {
    stubSuggestions();
    mockUseMatches.mockReturnValue({ data: [{ matchId: 'm1', flameRiteRequired: true, flameRiteCompletedAt: null }] });

    const { getByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(getByText('Complete the Flame Rite before pledging to meet')).toBeTruthy();
  });

  it('frees the pledge CTA once dating.flamerite.required is false, even though the rite was never completed', () => {
    stubSuggestions();
    mockUseMatches.mockReturnValue({ data: [{ matchId: 'm1', flameRiteRequired: false, flameRiteCompletedAt: null }] });

    const { queryByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(queryByText('Complete the Flame Rite before pledging to meet')).toBeNull();
  });

  it('does not lock the CTA once the rite is completed', () => {
    stubSuggestions();
    mockUseMatches.mockReturnValue({ data: [{ matchId: 'm1', flameRiteRequired: true, flameRiteCompletedAt: '2026-08-19T10:09:00Z' }] });

    const { queryByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(queryByText('Complete the Flame Rite before pledging to meet')).toBeNull();
  });

describe('ActivitiesScreen pledge states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMatches.mockReturnValue({ data: [{ matchId: 'm1', flameRiteRequired: false, flameRiteCompletedAt: null }] });
  });

  it('shows the "your turn" banner when the partner has pledged and I have not', () => {
    stubSuggestions({ partnerPledged: true });

    const { getByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(getByText('Your match has pledged — your turn to seal it.')).toBeTruthy();
  });

  it('hides the "your turn" banner when nobody has pledged yet', () => {
    stubSuggestions({ partnerPledged: false });

    const { queryByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(queryByText('Your match has pledged — your turn to seal it.')).toBeNull();
  });

  it('shows the waiting-on-partner status once I have pledged but the pair is not complete', () => {
    stubSuggestions({ suggestions: [{ ...suggestion, myConfirmed: true, isComplete: false }], partnerPledged: false });

    const { getByText, queryByText } = render(<WithSafeArea><ActivitiesScreen /></WithSafeArea>);

    expect(getByText('Pledged. Waiting on your match to confirm.')).toBeTruthy();
    expect(queryByText('Your match has pledged — your turn to seal it.')).toBeNull();
  });
});
});
