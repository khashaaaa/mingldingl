import { MutationCache, QueryClient } from '@tanstack/react-query';
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
  });
  return qc;
}

export const queryClient = createAppQueryClient();
