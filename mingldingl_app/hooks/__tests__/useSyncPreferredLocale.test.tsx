import { act, renderHook } from '@testing-library/react-native';
import { useSyncPreferredLocale } from '../useSyncPreferredLocale';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { update: jest.fn() } },
}));

const mockInvalidate = jest.fn();
const mockSetQueryData = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate, setQueryData: mockSetQueryData }),
}));

const mockUpdate = apiClient.users.update as jest.Mock;

describe('useSyncPreferredLocale', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockInvalidate.mockReset();
    mockSetQueryData.mockReset();
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

  it('drops cached authored content, which the engine serves in the stored language', async () => {
    // Icebreaker prompts and quiz questions are picked by PreferredLocale on the server. Switching
    // language without dropping them left a Mongolian reader looking at English questions inside an
    // otherwise Mongolian app, until the cache happened to expire.
    renderHook(() => useSyncPreferredLocale('mn', 'en'));
    await act(async () => {});

    const invalidated = mockInvalidate.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(invalidated).toEqual(expect.arrayContaining(['icebreaker', 'quiz', 'townSquareCurrentRound']));
  });

  it('drops cached venue content too, for the same reason', async () => {
    // BusinessController now picks Name/Category/District/Description by PreferredLocale as well
    // (LocalisedContent), so a venue read in one language and cached must not survive a switch —
    // same bug as the icebreaker/quiz case above, just for the Mission Board and venue detail screens.
    renderHook(() => useSyncPreferredLocale('mn', 'en'));
    await act(async () => {});

    const invalidated = mockInvalidate.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(invalidated).toEqual(expect.arrayContaining(['business', 'activity']));
    // Review text is user-written, not authored/localised server content, so it is not dropped.
    expect(invalidated).not.toContain('businessReviews');
  });

  // `storedLocale` comes off the cached profile. Without writing the new value back, switching
  // en → mn → en compared "en" against the stale "en" and never told the engine about the return.
  it('records the synced locale on the cached profile so switching back syncs too', async () => {
    renderHook(() => useSyncPreferredLocale('mn', 'en'));
    await act(async () => {});

    expect(mockSetQueryData).toHaveBeenCalledWith(['userProfile'], expect.any(Function));
    const updater = mockSetQueryData.mock.calls[0][1];
    expect(updater({ id: 'u1', preferredLocale: 'en' })).toEqual({ id: 'u1', preferredLocale: 'mn' });
    expect(updater(null)).toBeNull();
  });

  it('leaves the cached profile alone when the engine refused the change', async () => {
    mockUpdate.mockRejectedValue(new Error('offline'));
    renderHook(() => useSyncPreferredLocale('mn', 'en'));
    await act(async () => {});

    expect(mockSetQueryData).not.toHaveBeenCalled();
  });

  it('leaves the cache alone when there was nothing to sync', async () => {
    renderHook(() => useSyncPreferredLocale('mn', 'mn'));
    await act(async () => {});

    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
