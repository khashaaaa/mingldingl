import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';
import { toDroppedItem } from '../lib/tiers';
import { queryKeys } from '../lib/api/queryKeys';

export interface IcebreakerQuestion {
  id: string;
  questionText: string;
  type: string;
  options: string[];
}

export interface IcebreakerRevealEntry {
  userId: string;
  answer: string;
}

export function useIcebreaker(matchId: string) {
  const qc = useQueryClient();
  const myId = useAuthStore((s) => s.session?.user.id);

  const { data: question, isLoading } = useQuery<IcebreakerQuestion>({
    queryKey: queryKeys.icebreaker(matchId),
    queryFn: async () => {
      const res = await apiClient.engagement.icebreaker(matchId);
      return {
        id: res.id ?? '',
        questionText: res.questionText ?? '',
        type: res.type ?? '',
        options: res.options ?? [],
      };
    },
    enabled: !!matchId,
    staleTime: Infinity,
  });

  const { data: reveal } = useQuery<IcebreakerRevealEntry[] | null>({
    queryKey: queryKeys.icebreakerReveal(matchId, question?.id),
    queryFn: async () => {
      try {
        const res = await apiClient.engagement.icebreakerReveal(matchId, question!.id);
        return res.map((r) => ({ userId: r.userId ?? '', answer: r.answer ?? '' }));
      } catch (err) {
        // 400 = "both users haven't responded yet" (RevealIcebreaker) —
        // that's the expected steady state to poll through. Anything else
        // (404 match gone, 403 not a participant) is permanent and must
        // rethrow, or this poll would otherwise retry every 3s forever.
        if (isAxiosError(err) && err.response?.status === 400) return null;
        throw err;
      }
    },
    enabled: !!question && !!matchId,
    refetchInterval: (query) => (query.state.data || query.state.status === 'error' ? false : 3000),
  });

  // Server-derived "did I already answer this icebreaker for this match" —
  // runs unconditionally once the question loads (not gated on local
  // mutation state, which resets on every remount), so leaving the waiting
  // screen and coming back shows the waiting/reveal state instead of
  // re-prompting the question and risking a 409 "Already responded" on
  // resubmit. Mirrors useQuiz.ts's identical `status` query.
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.icebreakerStatus(matchId, question?.id),
    queryFn: async () => {
      const res = await apiClient.engagement.icebreakerStatus(matchId, question!.id);
      return { hasResponded: res.hasResponded ?? false };
    },
    enabled: !!question && !!matchId,
  });

  const respond = useMutation({
    mutationFn: async (answer: string) => {
      if (!question) throw new Error('No icebreaker question loaded');
      return apiClient.engagement.icebreakerRespond(matchId, { icebreakerId: question.id, answer });
    },
    // The score only lands once BOTH participants have answered — bumping
    // by a hardcoded amount on every submit (including the first responder,
    // who hasn't earned anything yet) shows a score that then reverts once
    // the next natural refetch reconciles it. awardedSelector reflects the
    // server's actual total, which is 0 until bothResponded. Quests is
    // invalidated unconditionally here (harmless on the non-completing
    // submit — the board just refetches unchanged data) rather than
    // duplicating the bothResponded gate a second time.
    meta: {
      invalidates: [queryKeys.quests],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.icebreakerStatus(matchId, question?.id), { hasResponded: true });
      if (data.bothResponded) {
        qc.invalidateQueries({ queryKey: queryKeys.icebreakerReveal(matchId, question?.id) });
      }
    },
  });

  const myAnswer = reveal?.find((r) => r.userId === myId)?.answer;
  const partnerAnswer = reveal?.find((r) => r.userId !== myId)?.answer;
  const isComplete = !!reveal;
  const hasResponded = status?.hasResponded ?? false;

  function submitAnswer(answer: string) {
    if (respond.isPending || hasResponded) return;
    respond.mutate(answer);
  }

  return {
    question,
    isLoading: isLoading || (!!question && statusLoading),
    submitAnswer,
    hasResponded,
    isWaitingForPartner: hasResponded && !isComplete,
    isComplete,
    myAnswer,
    partnerAnswer,
    droppedItem: toDroppedItem(respond.data?.droppedItem),
    awarded: respond.data?.awarded ?? 0,
    submitError: respond.isError,
    clearSubmitError: respond.reset,
  };
}
