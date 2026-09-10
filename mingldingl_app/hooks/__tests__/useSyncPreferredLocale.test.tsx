import { act, renderHook } from '@testing-library/react-native';
import { useSyncPreferredLocale } from '../useSyncPreferredLocale';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { update: jest.fn() } },
}));

const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

const mockUpdate = apiClient.users.update as jest.Mock;

describe('useSyncPreferredLocale', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockInvalidate.mockReset();
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

  it('leaves the cache alone when there was nothing to sync', async () => {
    renderHook(() => useSyncPreferredLocale('mn', 'mn'));
    await act(async () => {});

    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
