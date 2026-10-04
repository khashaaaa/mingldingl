import { useProfile } from './useProfile';
import { useMatches } from './useMatches';
import { useQuests } from './useQuests';
import { useScoreDetail } from './useScoreDetail';
import { matchName } from '../lib/reveal';

export type NextAction =
  | { kind: 'finish_profile' }
  | { kind: 'icebreaker'; matchId: string; name: string }
  | { kind: 'claim_chest' }
  | { kind: 'quest_progress'; progress: number; target: number }
  | { kind: 'streak'; days: number };

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
      name: matchName(pendingIcebreaker),
    };
  }

  if (board?.allComplete && !board.chestClaimed) {
    return { kind: 'claim_chest' };
  }

  // Counted across the whole board, because the chest this line promises needs every quest. It
  // used to count the closest single quest, so a three-quest day read "0/1 — finish today's quest".
  const quests = (board?.quests ?? []).filter((q) => (q.target ?? 0) > 0);
  const done = quests.filter((q) => q.completed).length;
  if (done < quests.length) {
    return { kind: 'quest_progress', progress: done, target: quests.length };
  }

  if ((scoreDetail?.currentStreak ?? 0) > 0) {
    return { kind: 'streak', days: scoreDetail!.currentStreak! };
  }

  return null;
}
