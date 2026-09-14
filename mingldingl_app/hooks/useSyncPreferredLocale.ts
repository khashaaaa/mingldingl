import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import type { UserProfile } from '../models/user';

/**
 * Keeps the engine's copy of the user's language in step with the app's. Push notifications are
 * localised per recipient from this value, and so is authored content — icebreaker prompts, quiz
 * questions and their options, and venue name/category/district/description, are picked
 * server-side by `PreferredLocale`. Fires once per locale change, and only after the profile has
 * loaded so a fresh install does not race account creation.
 *
 * The cached copies of that content have to go with it: they were fetched in the previous language,
 * and without this a reader who switched to Mongolian kept looking at English questions inside an
 * otherwise Mongolian app until the cache happened to expire. Sync failures are swallowed — the
 * next locale change or app start retries — but the cache is dropped either way, since the wrong
 * language on screen is worse than one extra fetch.
 *
 * The list below is deliberately narrow — only families that carry server-authored, locale-picked
 * text, not the user's own data (sweeping the whole cache on a language switch would refetch
 * everything for no reason). `businessReviews` is left out on purpose: a review's `Review` text is
 * written by the user who left it, not authored/localised server content.
 */
export function useSyncPreferredLocale(locale: string, storedLocale: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (storedLocale === undefined || storedLocale === locale) return;

    const dropLocalisedContent = () => {
      for (const key of [
        queryKeys.icebreaker(''),
        queryKeys.quiz(''),
        queryKeys.townSquareCurrentRound(''),
        queryKeys.business(''),
        queryKeys.activity,
      ]) {
        // Match on the family, not the exact key: every match's/venue's copy is in the old language.
        queryClient.invalidateQueries({ queryKey: [key[0]] });
      }
    };

    apiClient.users.update({ preferredLocale: locale })
      .then(() => {
        // `storedLocale` is read off the cached profile. Leaving it at the old value meant that
        // switching back (mn → en after en → mn) compared equal to the stale copy and never synced.
        queryClient.setQueryData<UserProfile | null>(queryKeys.userProfile, (old) =>
          (old ? { ...old, preferredLocale: locale } : old));
      })
      .catch(() => {})
      .finally(dropLocalisedContent);
  }, [locale, storedLocale, queryClient]);
}
