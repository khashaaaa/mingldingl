import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export interface DailyMatchBudget {
  budget: number;
  used: number;
  remaining: number;
}

export function useScore() {
  return useQuery({
    queryKey: queryKeys.score,
    queryFn: () => apiClient.scores.me(),
    staleTime: 1000 * 60,
  });
}

export function useDailyMatchBudget(): DailyMatchBudget | null {
  const { data } = useScore();
  if (!data || data.dailyMatchBudget == null) return null;
  const budget = data.dailyMatchBudget;
  const used = data.dailyMatchesUsed ?? 0;
  return {
    budget,
    used,
    remaining: data.dailyMatchesRemaining ?? Math.max(0, budget - used),
  };
}
