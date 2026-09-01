import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { toDroppedItem } from '../lib/tiers';
import { queryKeys } from '../lib/api/queryKeys';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface QuizData {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export function useQuiz(matchId: string) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data: quiz, isLoading: quizLoading, isError: quizLoadError, refetch: refetchQuiz } = useQuery<QuizData>({
    queryKey: queryKeys.quiz(matchId),
    queryFn: async () => {
      const res = await apiClient.engagement.quiz(matchId);
      return {
        id: res.id ?? '',
        title: res.title ?? '',
        questions: (res.questions ?? []).map((q) => ({
          id: q.id ?? '', text: q.text ?? '', options: q.options ?? [],
        })),
      };
    },
    staleTime: Infinity,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.quizStatus(matchId, quiz?.id),
    queryFn: async () => {
      const res = await apiClient.engagement.quizStatus(quiz!.id, matchId);
      return { hasResponded: res.hasResponded ?? false, compatibility: res.compatibility ?? null };
    },
    enabled: !!quiz && !!matchId,
    refetchInterval: (query) => (query.state.data?.compatibility != null ? false : 60000),
  });

  const answeredCount = Object.keys(answers).length;

  const submit = useMutation({
    mutationFn: (finalAnswers: Record<string, string>) =>
      apiClient.engagement.quizRespond(quiz!.id, { matchId, answers: finalAnswers }),
    meta: {
      invalidates: [queryKeys.quests, queryKeys.campaignAll],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
      silentError: true,
    },
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.quizStatus(matchId, quiz?.id), {
        hasResponded: true,
        compatibility: res.compatibility ?? null,
      });
    },
  });

  function submitAnswer(questionId: string, answer: string) {
    if (answers[questionId] !== undefined) return;
    const next = { ...answers, [questionId]: answer };
    setAnswers(next);
    if (quiz && Object.keys(next).length >= quiz.questions.length) {
      submit.mutate(next, {
        onError: () => setAnswers((prev) => {
          const { [questionId]: _submitted, ...rest } = prev;
          return rest;
        }),
      });
    }
  }

  const hasResponded = status?.hasResponded ?? false;

  const currentQuestion = quiz && quiz.questions.length > 0
    ? quiz.questions[Math.min(answeredCount, quiz.questions.length - 1)]
    : undefined;
  const compatibility = status?.compatibility ?? null;
  const isWaitingForPartner = hasResponded && compatibility === null;

  return {
    quiz,
    isLoading: quizLoading || (!!quiz && statusLoading),
    isLoadError: quizLoadError,
    refetchQuiz,
    currentQuestion,
    answeredCount,
    submitAnswer,
    allAnswered: hasResponded,
    isWaitingForPartner,
    compatibility,
    droppedItem: toDroppedItem(submit.data?.droppedItem),
    awarded: submit.data?.awarded ?? 0,
    submitError: submit.isError,
    clearSubmitError: submit.reset,
  };
}
