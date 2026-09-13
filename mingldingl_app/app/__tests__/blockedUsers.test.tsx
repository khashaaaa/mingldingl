import { render, fireEvent } from '@testing-library/react-native';
import BlockedUsersScreen from '../blocked-users';
import type { BlockedUser } from '../../models/blockedUser';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../../hooks/useScrollTail', () => ({ useScrollTail: () => 0 }));

const mockUnblock = jest.fn();
let mockBlockedUsers: BlockedUser[] = [];
let mockIsError = false;

jest.mock('../../hooks/useBlockedUsers', () => ({
  useBlockedUsers: () => ({
    blockedUsers: mockBlockedUsers,
    isLoading: false,
    isError: mockIsError,
    refetch: jest.fn(),
    unblock: mockUnblock,
    unblockingUserId: null,
  }),
}));

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString();
// FrostEdge hides itself from assistive tech, and RNTL's default queries skip hidden elements.
const HIDDEN = { includeHiddenElements: true };

describe('BlockedUsersScreen — the Frozen Gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsError = false;
    // "Now" pinned so the dawn count on a row is deterministic: three local midnights after
    // the blocking (Sep 10 -> Sep 13), the same law `threadDay` is already tested against.
    jest.useFakeTimers({ now: new Date(2026, 8, 13, 10) });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('names the gate and states the law under the header', () => {
    mockBlockedUsers = [];
    const { getByText } = render(<BlockedUsersScreen />);
    expect(getByText('The Frozen Gate')).toBeTruthy();
    expect(getByText(
      'Names shut out in the cold. They cannot see you, summon you, or find you in the square.',
    )).toBeTruthy();
  });

  it('shows a warm gate when nobody is shut out', () => {
    mockBlockedUsers = [];
    const { getByText } = render(<BlockedUsersScreen />);
    expect(getByText('No one is shut out. The gate is warm.')).toBeTruthy();
  });

  it('gives each row a dawn line, a Thaw button and a frost edge', () => {
    mockBlockedUsers = [
      { userId: 'u1', displayName: 'Bat', firstPhoto: undefined, blockedAt: at(2026, 9, 10, 8) },
    ];
    const { getByText, getAllByTestId } = render(<BlockedUsersScreen />);
    expect(getByText('Bat')).toBeTruthy();
    expect(getByText('Shut out on the fourth dawn')).toBeTruthy();
    expect(getByText('Thaw')).toBeTruthy();
    expect(getAllByTestId('frost-edge-left', HIDDEN)).toHaveLength(1);
  });

  it('omits the dawn line when the engine gave no blockedAt', () => {
    mockBlockedUsers = [
      { userId: 'u2', displayName: 'Sara', firstPhoto: undefined, blockedAt: '' },
    ];
    const { getByText, queryByText } = render(<BlockedUsersScreen />);
    expect(getByText('Sara')).toBeTruthy();
    expect(queryByText(/Shut out on the/)).toBeNull();
  });

  it('still lifts the ban through the unchanged unblock flow', () => {
    mockBlockedUsers = [
      { userId: 'u1', displayName: 'Bat', firstPhoto: undefined, blockedAt: at(2026, 9, 10, 8) },
    ];
    const { getByText } = render(<BlockedUsersScreen />);
    fireEvent.press(getByText('Thaw'));
    expect(mockUnblock).toHaveBeenCalledWith('u1');
  });
});
