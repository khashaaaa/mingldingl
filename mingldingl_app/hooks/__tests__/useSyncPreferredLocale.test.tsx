import { renderHook } from '@testing-library/react-native';
import { useSyncPreferredLocale } from '../useSyncPreferredLocale';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { update: jest.fn() } },
}));

const mockUpdate = apiClient.users.update as jest.Mock;

describe('useSyncPreferredLocale', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({});
  });

  it('tells the engine when the app locale differs from the stored preference', () => {
    renderHook(() => useSyncPreferredLocale('mn', 'en'));

    expect(mockUpdate).toHaveBeenCalledWith({ preferredLocale: 'mn' });
  });

  it('stays quiet when the engine already has the current locale', () => {
    renderHook(() => useSyncPreferredLocale('mn', 'mn'));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('waits until the profile has loaded', () => {
    renderHook(() => useSyncPreferredLocale('mn', undefined));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('re-syncs when the locale changes again', () => {
    const { rerender } = renderHook(({ locale }) => useSyncPreferredLocale(locale, 'en'), { initialProps: { locale: 'en' } });
    expect(mockUpdate).not.toHaveBeenCalled();

    rerender({ locale: 'mn' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ preferredLocale: 'mn' });
  });
});
