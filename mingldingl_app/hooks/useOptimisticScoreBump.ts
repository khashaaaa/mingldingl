import { useQueryClient } from '@tanstack/react-query';
import { applyScoreBump } from '../lib/api/queryClient';

export function useOptimisticScoreBump() {
  const queryClient = useQueryClient();
  return (points: number) => applyScoreBump(queryClient, points);
}
