import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Alert } from 'react-native';
import { i18n } from '../i18n';
import { getApiErrorMessage } from './errors';
import { areTierThresholdsHydrated, tierForScore } from '../tiers';
import { useAuthStore } from '../../store/authStore';
import { queryKeys } from './queryKeys';
import type { components } from './api.generated';

type ScoreDetailResponse = components['schemas']['ScoreDetailResponse'];

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /**
       * Set on queries whose failure the user should not be told about — either the screen
       * renders its own error state, or the UI degrades past the missing data silently.
       */
      silentError?: boolean;
    };

    mutationMeta: {
      invalidates?: readonly (readonly unknown[])[];

      awardedSelector?: (data: unknown) => number | undefined;

      silentError?: boolean;
    };
  }
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) return false;
  }
  return failureCount < 1;
}

export function applyScoreBump(qc: QueryClient, points: number): void {
  qc.setQueryData<ScoreDetailResponse>(queryKeys.scoreDetail, (old) => {
    if (!old || old.totalScore == null || !old.gemTier) return old;
    const newScore = old.totalScore + points;

    if (!areTierThresholdsHydrated()) return { ...old, totalScore: newScore };
    const newTier = tierForScore(newScore);
    if (newTier !== old.gemTier) useAuthStore.getState().setPendingTierUp(newTier);
    return { ...old, totalScore: newScore, gemTier: newTier };
  });

  qc.invalidateQueries({ queryKey: queryKeys.scoreDetail, refetchType: 'none' });

  qc.invalidateQueries({ queryKey: queryKeys.scoreHistory });
}

/**
 * Last-resort notice for a failed read. Screens that render their own error state opt out via
 * `meta.silentError`; without this a failed query is indistinguishable from an empty result,
 * because a screen branching only on isLoading falls through to its empty state.
 */
function createQueryCache(): QueryCache {
  let lastNoticeAt = 0;
  const NOTICE_COOLDOWN_MS = 10_000;

  return new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError === true) return;
      // Signing out clears the token and the cache under whatever was in flight, so those reads
      // fail on the way down. Every query this handler can see is session-gated, so with no
      // session there is no real failure left to report — only teardown noise.
      if (!useAuthStore.getState().session) return;
      // A dropped connection fails every mounted query at once — only speak up once.
      const now = Date.now();
      if (now - lastNoticeAt < NOTICE_COOLDOWN_MS) return;
      lastNoticeAt = now;

      Alert.alert(
        i18n.t('load_failed_title'),
        getApiErrorMessage(error, i18n.t('load_failed_body')),
      );
    },
  });
}

export function createAppQueryClient(overrides?: {
  queries?: Record<string, unknown>;
  mutations?: Record<string, unknown>;
}): QueryClient {
  let qc: QueryClient;
  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError || mutation.options.meta?.silentError === true) return;
      Alert.alert(
        i18n.t('action_failed_title'),
        getApiErrorMessage(error, i18n.t('action_failed_body')),
      );
    },
    onSuccess: (data, _variables, _context, mutation) => {
      const meta = mutation.options.meta;
      meta?.invalidates?.forEach((key) => qc.invalidateQueries({ queryKey: key as readonly unknown[] }));
      const awarded = meta?.awardedSelector?.(data) ?? 0;
      if (awarded > 0) applyScoreBump(qc, awarded);
    },
  });
  qc = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 1000 * 60 * 5, retry: shouldRetry, ...overrides?.queries },
      mutations: { ...overrides?.mutations },
    },
    mutationCache,
    queryCache: createQueryCache(),
  });
  return qc;
}

export const queryClient = createAppQueryClient();
