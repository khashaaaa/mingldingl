import { useQueryClient } from '@tanstack/react-query';
import { applyScoreBump } from '../lib/api/queryClient';

// Thin hook wrapper around applyScoreBump (lib/api/queryClient.ts) — kept
// for call sites inside components/hooks that bump score outside a
// react-query mutation's own success path (QuestBoard's chest claim,
// TrophyCase's milestone open, the video-call screen, daily login in
// _layout.tsx). Mutations that declare `meta.awardedSelector` get this for
// free from MutationCache's global onSuccess instead of calling this hook.
export function useOptimisticScoreBump() {
  const queryClient = useQueryClient();
  return (points: number) => applyScoreBump(queryClient, points);
}
