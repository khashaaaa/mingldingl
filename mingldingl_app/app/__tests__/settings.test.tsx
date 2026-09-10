import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsScreen from '../settings';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

// The screen mounts PhoneChangeModal, which reaches into the same module for a helper.
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
  isPhoneValid: (phone: string) => /^\d{8}$/.test(phone),
}));

let mockDeletionRequestedAt: string | null = null;
jest.mock('../../hooks/useProfile', () => ({
  useProfile: () => ({
    data: {
      id: 'u1', displayName: 'Test', ageMin: 18, ageMax: 99, isPaused: false,
      pushEnabled: true, phoneNumber: '88110001', deletionGraceDays: 7,
      preferredLocale: 'en', deletionRequestedAt: mockDeletionRequestedAt,
    },
  }),
  useUpdateProfile: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    users: { requestDeletion: jest.fn(), cancelDeletion: jest.fn() },
  },
}));

jest.mock('../../hooks/useScrollTail', () => ({ useScrollTail: () => 0 }));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>,
  );
}

describe('SettingsScreen deletion', () => {
  beforeEach(() => {
    mockDeletionRequestedAt = null;
    jest.clearAllMocks();
  });

  it('offers deletion while none is pending', () => {
    const { getByText, queryByText } = renderScreen();
    expect(getByText('ABANDON THIS CHARACTER')).toBeTruthy();
    expect(queryByText('Deletion pending')).toBeNull();
  });

  it('shows the pending deletion and a way to call it off', async () => {
    // The engine stopped cancelling on GET /users/me — the app's most-polled endpoint — so a
    // pending deletion has to be visible here and cancelled deliberately, or it was revoked by a
    // background refetch with nothing on screen to say it had happened.
    mockDeletionRequestedAt = '2026-09-06T00:00:00Z';
    const { getByText, queryByText } = renderScreen();

    expect(getByText('Deletion pending')).toBeTruthy();
    expect(queryByText('ABANDON THIS CHARACTER')).toBeNull();

    fireEvent.press(getByText('KEEP MY CHARACTER'));
    await waitFor(() => expect(apiClient.users.cancelDeletion).toHaveBeenCalledTimes(1));
  });
});
