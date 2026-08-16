import { useProfile } from './useProfile';
import { useMatches } from './useMatches';
import { useQuests } from './useQuests';
import { useScoreDetail } from './useScoreDetail';

export type NextAction =
  | { kind: 'finish_profile' }
  | { kind: 'icebreaker'; matchId: string; name: string }
  | { kind: 'claim_chest' }
  | { kind: 'quest_progress'; progress: number; target: number }
  | { kind: 'streak'; days: number };

// Reduces the score/tier/reputation/membership/quest stack down to a single
// "what do I do right now" prompt, picked in priority order from data the
// app already fetches elsewhere (no new network calls). Returns null once
// there's genuinely nothing actionable to surface.
export function useNextAction(): NextAction | null {
  const { data: profile } = useProfile();
  const { data: matches } = useMatches();
  const { board } = useQuests();
  const { data: scoreDetail } = useScoreDetail();

  if (profile && !profile.isProfileComplete) {
    return { kind: 'finish_profile' };
  }

  const pendingIcebreaker = (matches ?? []).find(
    (m) => m.status === 'Active' && !m.icebreakerComplete,
  );
  if (pendingIcebreaker) {
    return {
      kind: 'icebreaker',
      matchId: pendingIcebreaker.matchId,
      name: pendingIcebreaker.otherUser.displayName ?? '',
    };
  }

  if (board?.allComplete && !board.chestClaimed) {
    return { kind: 'claim_chest' };
  }

  const closestQuest = (board?.quests ?? [])
    .filter((q) => !q.completed && (q.target ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) / (b.target ?? 1) - (a.progress ?? 0) / (a.target ?? 1))[0];
  if (closestQuest) {
    return { kind: 'quest_progress', progress: closestQuest.progress ?? 0, target: closestQuest.target ?? 0 };
  }

  if ((scoreDetail?.currentStreak ?? 0) > 0) {
    return { kind: 'streak', days: scoreDetail!.currentStreak! };
  }

  return null;
}
