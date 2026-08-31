import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useQuiz } from '../useQuiz';
import { apiClient } from '../../lib/api/apiClient';
import { supabase } from '../../lib/supabase';
import { createAppQueryClient } from '../../lib/api/queryClient';
import { queryKeys } from '../../lib/api/queryKeys';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    engagement: {
      quiz: jest.fn(),
      quizStatus: jest.fn(),
      quizRespond: jest.fn(),
    },
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const mockApi = apiClient as unknown as {
  engagement: {
    quiz: jest.Mock;
    quizStatus: jest.Mock;
    quizRespond: jest.Mock;
  };
};

function makeQueryClient() {
  return createAppQueryClient({
    queries: { retry: false },
    mutations: { retry: false },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const quiz = {
  id: 'quiz1',
  title: 'Compat quiz',
  questions: [
    { id: 'q1', text: 'Q1', options: ['a', 'b'] },
    { id: 'q2', text: 'Q2', options: ['a', 'b'] },
    { id: 'q3', text: 'Q3', options: ['a', 'b'] },
  ],
};

describe('useQuiz answer state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.engagement.quiz.mockResolvedValue(quiz);
    mockApi.engagement.quizStatus.mockResolvedValue({ hasResponded: false, compatibility: null });
  });

  it('accumulates answers locally without submitting until the last question is answered', async () => {
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));

    act(() => {
      result.current.submitAnswer('q1', 'a');
    });
    expect(result.current.answeredCount).toBe(1);
    expect(result.current.currentQuestion?.id).toBe('q2');
    expect(mockApi.engagement.quizRespond).not.toHaveBeenCalled();

    act(() => {
      result.current.submitAnswer('q2', 'b');
    });
    expect(result.current.answeredCount).toBe(2);
    expect(result.current.currentQuestion?.id).toBe('q3');
    expect(mockApi.engagement.quizRespond).not.toHaveBeenCalled();
  });

  it('ignores re-answering a question that already has an answer (does not overwrite it)', async () => {
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));

    act(() => {
      result.current.submitAnswer('q1', 'a');
    });
    expect(result.current.answeredCount).toBe(1);

    act(() => {
      result.current.submitAnswer('q1', 'b');
    });
    expect(result.current.answeredCount).toBe(1);
    expect(result.current.currentQuestion?.id).toBe('q2');
  });

  it('submits once the last question is answered, and on success stores compatibility + marks hasResponded', async () => {
    mockApi.engagement.quizRespond.mockResolvedValue({ compatibility: 0.75, droppedItem: null });
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));

    act(() => { result.current.submitAnswer('q1', 'a'); });
    act(() => { result.current.submitAnswer('q2', 'a'); });
    act(() => { result.current.submitAnswer('q3', 'a'); });

    await waitFor(() => expect(mockApi.engagement.quizRespond).toHaveBeenCalledTimes(1));
    expect(mockApi.engagement.quizRespond).toHaveBeenCalledWith('quiz1', {
      matchId: 'm1',
      answers: { q1: 'a', q2: 'a', q3: 'a' },
    });

    await waitFor(() => expect(result.current.allAnswered).toBe(true));
    expect(result.current.compatibility).toBe(0.75);
    expect(result.current.isWaitingForPartner).toBe(false);
    expect(result.current.answeredCount).toBe(3);
  });

  it('rolls back only the last answer on submit failure, so answeredCount and currentQuestion stay consistent for a retry', async () => {
    mockApi.engagement.quizRespond.mockRejectedValueOnce(new Error('network down'));
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));

    act(() => { result.current.submitAnswer('q1', 'a'); });
    act(() => { result.current.submitAnswer('q2', 'b'); });
    await act(async () => {
      result.current.submitAnswer('q3', 'a');

      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(result.current.submitError).toBe(true));

    expect(result.current.answeredCount).toBe(2);
    expect(result.current.currentQuestion?.id).toBe('q3');
    expect(result.current.allAnswered).toBe(false);

    mockApi.engagement.quizRespond.mockResolvedValueOnce({ compatibility: 0.5 });
    await act(async () => {
      result.current.submitAnswer('q3', 'a');
    });

    await waitFor(() => expect(result.current.allAnswered).toBe(true));
    expect(mockApi.engagement.quizRespond).toHaveBeenCalledTimes(2);
    expect(mockApi.engagement.quizRespond).toHaveBeenLastCalledWith('quiz1', {
      matchId: 'm1',
      answers: { q1: 'a', q2: 'b', q3: 'a' },
    });
  });

  it('clearSubmitError resets submit.isError without touching answers/answeredCount', async () => {
    mockApi.engagement.quizRespond.mockRejectedValueOnce(new Error('boom'));
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));
    act(() => { result.current.submitAnswer('q1', 'a'); });
    act(() => { result.current.submitAnswer('q2', 'b'); });
    await act(async () => {
      result.current.submitAnswer('q3', 'a');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.submitError).toBe(true));

    act(() => { result.current.clearSubmitError(); });
    await waitFor(() => expect(result.current.submitError).toBe(false));
    expect(result.current.answeredCount).toBe(2);
  });

  describe('score bump only reflects a real award', () => {
    const baseScoreDetail = {
      totalScore: 50, gemTier: 'Garnet', reputationScore: 1, currentStreak: 0, longestStreak: 0,
      tierIndex: 0, tierBonus: 0, nextTier: 'Opal', nextTierThreshold: 100, progressPct: 50,
      dailyMatchBudget: 5,
    };

    it('bumps the score by the server-reported award on first submission', async () => {
      mockApi.engagement.quizRespond.mockResolvedValue({ compatibility: 0.75, awarded: 15, droppedItem: null });
      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));
      act(() => { result.current.submitAnswer('q1', 'a'); });
      act(() => { result.current.submitAnswer('q2', 'a'); });
      act(() => { result.current.submitAnswer('q3', 'a'); });

      await waitFor(() => expect(result.current.allAnswered).toBe(true));
      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(65);
      expect(result.current.awarded).toBe(15);
    });

    it('does NOT bump the score on a repeat submission (server reports awarded: 0)', async () => {
      mockApi.engagement.quizRespond.mockResolvedValue({ compatibility: 0.75, awarded: 0, droppedItem: null });
      const queryClient = makeQueryClient();
      queryClient.setQueryData(queryKeys.scoreDetail, baseScoreDetail);
      const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

      await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q1'));
      act(() => { result.current.submitAnswer('q1', 'a'); });
      act(() => { result.current.submitAnswer('q2', 'a'); });
      act(() => { result.current.submitAnswer('q3', 'a'); });

      await waitFor(() => expect(result.current.allAnswered).toBe(true));
      expect((queryClient.getQueryData(queryKeys.scoreDetail) as typeof baseScoreDetail).totalScore).toBe(50);
    });
  });

  it('derives isWaitingForPartner from hasResponded=true with compatibility still null', async () => {
    mockApi.engagement.quizStatus.mockResolvedValue({ hasResponded: true, compatibility: null });
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.allAnswered).toBe(true));
    expect(result.current.isWaitingForPartner).toBe(true);
    expect(result.current.compatibility).toBeNull();

    act(() => {
      queryClient.setQueryData(queryKeys.quizStatus('m1', 'quiz1'), {
        hasResponded: true,
        compatibility: 0.42,
      });
    });

    await waitFor(() => expect(result.current.isWaitingForPartner).toBe(false));
    expect(result.current.compatibility).toBe(0.42);
  });

  it('does not open any realtime channel of its own', async () => {
    const queryClient = makeQueryClient();
    renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });
    await waitFor(() => expect(mockApi.engagement.quizStatus).toHaveBeenCalledTimes(1));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('refetches quizStatus when the quizStatusByMatch prefix is invalidated (what useRealtimeNudges does on the quiz broadcast)', async () => {
    mockApi.engagement.quizStatus.mockResolvedValue({ hasResponded: true, compatibility: null });
    const queryClient = makeQueryClient();
    renderHook(() => useQuiz('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(mockApi.engagement.quizStatus).toHaveBeenCalledTimes(1));

    mockApi.engagement.quizStatus.mockResolvedValue({ hasResponded: true, compatibility: 0.42 });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.quizStatusByMatch('m1') });
    });

    await waitFor(() => expect(mockApi.engagement.quizStatus).toHaveBeenCalledTimes(2));
  });
});
