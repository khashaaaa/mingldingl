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
        if (isAxiosError(err) && err.response?.status === 400) return null;
        throw err;
      }
    },
    enabled: !!question && !!matchId,
    refetchInterval: (query) => (query.state.data || query.state.status === 'error' ? false : 60000),
  });

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
    meta: {
      invalidates: [queryKeys.quests, queryKeys.matches, queryKeys.campaignAll],
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
