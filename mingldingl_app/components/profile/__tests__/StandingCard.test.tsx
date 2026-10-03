import { render } from '@testing-library/react-native';
import { StandingCard } from '../StandingCard';

jest.mock('expo-router', () => require('../../../lib/testing/expoRouterMock').expoRouterMock({ useRouter: () => ({ push: jest.fn() }) }));
const mockStanding: { data: Record<string, unknown> | undefined } = { data: undefined };
jest.mock('../../../hooks/useStanding', () => ({ useStanding: () => mockStanding }));

const standing = {
  partyEnabled: true, partySeats: 5, partyUsed: 3,
  openScars: 0, scarHealProgress: 0, scarHealNeeded: 2,
  districtsCharted: 1, cartographerNeeded: 3, retiredAt: null,
};

describe('StandingCard', () => {
  beforeEach(() => { mockStanding.data = undefined; });

  it('draws nothing until standing has loaded', () => {
    expect(render(<StandingCard gemTier="Opal" />).toJSON()).toBeNull();
  });

  it('counts seats, scars and districts', () => {
    mockStanding.data = standing;
    const { getByText } = render(<StandingCard gemTier="Opal" />);
    expect(getByText('3 of 5 seats taken')).toBeTruthy();
    expect(getByText('None. Every silence you owed is answered.')).toBeTruthy();
    expect(getByText('1 of 3 districts charted')).toBeTruthy();
  });

  it('names an open scar and how close it is to closing', () => {
    mockStanding.data = { ...standing, openScars: 1, scarHealProgress: 1 };
    const { getByText } = render(<StandingCard gemTier="Opal" />);
    expect(getByText('1 open. The next closes after 2 kept encounters (1 so far).')).toBeTruthy();
  });

  it('hides the seats when the party limit is off', () => {
    mockStanding.data = { ...standing, partyEnabled: false };
    const { queryByText } = render(<StandingCard gemTier="Opal" />);
    expect(queryByText('3 of 5 seats taken')).toBeNull();
  });
});
