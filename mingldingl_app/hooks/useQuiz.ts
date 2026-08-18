import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { supabase } from '../lib/supabase';
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
    queryKey: queryKeys.quiz,
    queryFn: async () => {
      const res = await apiClient.engagement.quiz();
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

  // Server-derived "did I already answer this quiz for this match" — runs
  // unconditionally once the quiz loads (not gated on local `answers`
  // state), so revisiting the screen after answering shows the compatibility
  // reveal instead of resetting to Question 1 of 3.
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.quizStatus(matchId, quiz?.id),
    queryFn: async () => {
      const res = await apiClient.engagement.quizStatus(quiz!.id, matchId);
      return { hasResponded: res.hasResponded ?? false, compatibility: res.compatibility ?? null };
    },
    enabled: !!quiz && !!matchId,
    // The broadcast effect below refetches immediately once the partner
    // responds; this interval is just the safety net for a missed/best-effort
    // broadcast (see SupabaseBroadcastService), so it can be much slower than
    // the old 4s straight poll.
    refetchInterval: (query) => (query.state.data?.compatibility != null ? false : 15000),
  });

  useEffect(() => {
    if (!matchId || !quiz) return;
    // EngagementController.RespondQuiz already broadcasts this on every
    // per-user first response (which is both directions in the normal
    // one-response-per-user flow) for useRealtimeNudges' toast — reusing
    // that same app-nudges event here instead of adding a second broadcast
    // call server-side.
    const channel = supabase
      .channel('app-nudges')
      .on('broadcast', { event: 'quiz' }, (msg) => {
        const payload = msg.payload as { matchId: string | null };
        if (payload.matchId !== matchId) return;
        qc.invalidateQueries({ queryKey: queryKeys.quizStatus(matchId, quiz.id) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId, quiz?.id]);

  const answeredCount = Object.keys(answers).length;

  const submit = useMutation({
    // Takes the final answers map as mutate variables rather than closing
    // over the `answers` state directly: `submitAnswer` calls `setAnswers`
    // and `submit.mutate` back-to-back synchronously, before React has
    // re-rendered and refreshed this mutation's closure. Reading `answers`
    // here would race that re-render — depending on microtask ordering the
    // mutationFn can fire before the state update lands, sending a payload
    // that's missing the answer that just triggered the submit.
    mutationFn: (finalAnswers: Record<string, string>) =>
      apiClient.engagement.quizRespond(quiz!.id, { matchId, answers: finalAnswers }),
    // Score only lands on the first response per (quiz, match, user) — a
    // resubmit awards nothing, so awardedSelector reflects the server's
    // actual total rather than assuming a fixed amount. The "Prove Your
    // Compatibility" daily quest only advances on that same first-response
    // path, so invalidating quests is exactly as gated as the award.
    meta: {
      invalidates: [queryKeys.quests],
      awardedSelector: (data) => (data as { awarded?: number }).awarded,
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
      // On failure, drop the last answer back out of local state — otherwise
      // `answeredCount` stays at the "complete" count, `currentQuestion`
      // (quiz.questions[answeredCount]) stays undefined, and the screen has
      // no question left to re-render even after the error alert fires.
      submit.mutate(next, {
        onError: () => setAnswers((prev) => {
          const { [questionId]: _submitted, ...rest } = prev;
          return rest;
        }),
      });
    }
  }

  const hasResponded = status?.hasResponded ?? false;
  // Clamped rather than a plain index: after the last answer, local
  // `answeredCount` reaches quiz.questions.length before the server-derived
  // `hasResponded` catches up, which would otherwise make this undefined
  // and blank the whole screen (app/quiz/[matchId].tsx's `if (!q) return
  // null`) for the round-trip duration. Clamping just keeps the last
  // question visible (already shown as answered/disabled) through that gap.
  const currentQuestion = quiz && quiz.questions.length > 0
    ? quiz.questions[Math.min(answeredCount, quiz.questions.length - 1)]
    : undefined;
  const compatibility = status?.compatibility ?? null;
  const isWaitingForPartner = hasResponded && compatibility === null;

  return {
    quiz,
    isLoading: quizLoading || (!!quiz && statusLoading),
    // Distinct from the generic "no quiz assigned" empty state (`!quiz` with
    // no error) — a fetch failure shouldn't render the same "nothing here"
    // screen as a genuine empty response.
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
