import { MutationCache, QueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { tierForScore } from '../tiers';
import { useAuthStore } from '../../store/authStore';
import { queryKeys } from './queryKeys';
import type { components } from './api.generated';

type ScoreDetailResponse = components['schemas']['ScoreDetailResponse'];

// Register is TanStack Query's own extension point for typing `meta`
// globally (there's one shape for every mutation in the app, not a
// per-mutation generic) — see MutationCache's onSuccess below for why this
// exists: it's the single place a new action declares its score/quest/
// milestone side effects instead of every hook hand-rolling its own
// invalidateQueries calls and risking forgetting one. That's exactly how
// five separate "action succeeded server-side but a related screen (quest
// board, trophy case, score HUD) went stale" bugs slipped in previously —
// each hook remembered *some* of the invalidations but not all of them.
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      invalidates?: readonly (readonly unknown[])[];
      // Pulls the real server-awarded score delta out of this mutation's
      // response, if any — must reflect what the server actually reported,
      // never a guessed constant (see applyScoreBump's contract below).
      awardedSelector?: (data: unknown) => number | undefined;
    };
  }
}

// A 4xx is the server telling us "no" for a reason that won't change on
// retry (e.g. activity suggestions' "keep chatting to unlock" gate) — only
// worth retrying network hiccups and 5xx, never a client error.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) return false;
  }
  return failureCount < 1;
}

// Extracted out of the old useOptimisticScoreBump hook so both the hook
// itself and MutationCache's onSuccess (which runs outside any component,
// so it can't call hooks) share one implementation. `points` must be a real
// server-reported award, not a guessed constant — callers that bumped by a
// hardcoded amount regardless of what the server actually awarded is the
// exact bug class this file's mutationMeta convention exists to prevent.
export function applyScoreBump(qc: QueryClient, points: number): void {
  qc.setQueryData<ScoreDetailResponse>(queryKeys.scoreDetail, (old) => {
    if (!old || old.totalScore == null || !old.gemTier) return old;
    const newScore = old.totalScore + points;
    const newTier = tierForScore(newScore);
    if (newTier !== old.gemTier) useAuthStore.getState().setPendingTierUp(newTier);
    return { ...old, totalScore: newScore, gemTier: newTier };
  });
  qc.invalidateQueries({ queryKey: queryKeys.scoreDetail });
  // Every caller here just awarded a real ScoreEvent server-side — without
  // this, the Progression screen's itemized history omits it until
  // scoreHistory's own staleTime (60s) lapses or the screen remounts.
  qc.invalidateQueries({ queryKey: queryKeys.scoreHistory });
}

// A factory rather than only a bare singleton: tests that need an isolated
// QueryClient (so cache state from one test can't leak into the next) still
// need this same mutationMeta-driven behavior wired up, or the invalidate/
// bump they're asserting on silently never fires — a `new QueryClient()`
// with no mutationCache is a different, weaker thing than the app actually
// runs on. Exported for that reason; the app itself just uses `queryClient`
// below.
export function createAppQueryClient(overrides?: {
  queries?: Record<string, unknown>;
  mutations?: Record<string, unknown>;
}): QueryClient {
  // The MutationCache needs a QueryClient reference for invalidateQueries/
  // applyScoreBump, but the QueryClient constructor needs the MutationCache
  // instance up front — `qc` is assigned right after construction, and
  // nothing invokes onSuccess synchronously during that gap (mutations only
  // resolve later, asynchronously), so the closure always sees it populated
  // by the time it actually runs.
  let qc: QueryClient;
  const mutationCache = new MutationCache({
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
