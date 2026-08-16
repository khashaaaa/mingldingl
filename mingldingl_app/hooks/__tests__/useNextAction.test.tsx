import { renderHook } from '@testing-library/react-native';
import { useNextAction } from '../useNextAction';
import { useProfile } from '../useProfile';
import { useMatches } from '../useMatches';
import { useQuests } from '../useQuests';
import { useScoreDetail } from '../useScoreDetail';
import type { UserProfile } from '../../models/user';
import type { Match } from '../../models/match';

// Factory form, not the bare `jest.mock('../useProfile')` automock — the
// automock still has to load the real module once to introspect its shape,
// which cascades into lib/supabase.ts's real createClient() call at module
// scope and throws on the missing EXPO_PUBLIC_SUPABASE_URL env var in the
// test environment. A factory skips loading the real module entirely.
jest.mock('../useProfile', () => ({ useProfile: jest.fn() }));
jest.mock('../useMatches', () => ({ useMatches: jest.fn() }));
jest.mock('../useQuests', () => ({ useQuests: jest.fn() }));
jest.mock('../useScoreDetail', () => ({ useScoreDetail: jest.fn() }));

const mockUseProfile = useProfile as jest.Mock;
const mockUseMatches = useMatches as jest.Mock;
const mockUseQuests = useQuests as jest.Mock;
const mockUseScoreDetail = useScoreDetail as jest.Mock;

function profile(overrides: Partial<UserProfile> = {}): { data: UserProfile } {
  return { data: { isProfileComplete: true, ...overrides } as UserProfile };
}

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'm1',
    otherUserId: 'u1',
    status: 'Active',
    revealLevel: 0,
    messageCount: 0,
    icebreakerComplete: true,
    videoCallUnlocked: false,
    otherUser: { displayName: 'Alex' },
    ...overrides,
  };
}

// Baseline: every data source present but with nothing actionable, so each
// test only needs to override the one thing it's exercising and the
// priority chain falls through to null instead of throwing on undefined data.
function setAllSources(overrides: {
  profile?: ReturnType<typeof profile>;
  matches?: Match[];
  board?: { quests?: unknown[]; allComplete?: boolean; chestClaimed?: boolean };
  scoreDetail?: { currentStreak?: number | null };
} = {}) {
  mockUseProfile.mockReturnValue(overrides.profile ?? profile());
  mockUseMatches.mockReturnValue({ data: overrides.matches ?? [] });
  mockUseQuests.mockReturnValue({ board: overrides.board ?? { quests: [], allComplete: false, chestClaimed: false } });
  mockUseScoreDetail.mockReturnValue({ data: overrides.scoreDetail ?? { currentStreak: 0 } });
}

describe('useNextAction priority order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when every data source is empty/incomplete-but-not-loaded', () => {
    setAllSources();
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('returns finish_profile when the profile is incomplete', () => {
    setAllSources({ profile: profile({ isProfileComplete: false }) });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'finish_profile' });
  });

  it('finish_profile outranks every other actionable source', () => {
    setAllSources({
      profile: profile({ isProfileComplete: false }),
      matches: [match({ status: 'Active', icebreakerComplete: false })],
      board: { quests: [{ progress: 1, target: 4, completed: false }], allComplete: true, chestClaimed: false },
      scoreDetail: { currentStreak: 5 },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'finish_profile' });
  });

  it('does not gate on profile when profile data has not loaded yet (undefined)', () => {
    mockUseProfile.mockReturnValue({ data: undefined });
    mockUseMatches.mockReturnValue({ data: [] });
    mockUseQuests.mockReturnValue({ board: undefined });
    mockUseScoreDetail.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('returns icebreaker for an Active match with an incomplete icebreaker', () => {
    setAllSources({ matches: [match({ matchId: 'm42', icebreakerComplete: false, otherUser: { displayName: 'Sam' } })] });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'icebreaker', matchId: 'm42', name: 'Sam' });
  });

  it('falls back to an empty name if the pending match has no displayName', () => {
    setAllSources({ matches: [match({ icebreakerComplete: false, otherUser: {} })] });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'icebreaker', matchId: 'm1', name: '' });
  });

  it('ignores a Pending/Ghosted/Completed match even with an incomplete icebreaker', () => {
    setAllSources({
      matches: [
        match({ status: 'Pending', icebreakerComplete: false }),
        match({ status: 'Ghosted', icebreakerComplete: false }),
        match({ status: 'Completed', icebreakerComplete: false }),
      ],
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('ignores an Active match whose icebreaker is already complete', () => {
    setAllSources({ matches: [match({ status: 'Active', icebreakerComplete: true })] });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('icebreaker outranks claim_chest and quest_progress', () => {
    setAllSources({
      matches: [match({ icebreakerComplete: false })],
      board: { quests: [{ progress: 1, target: 4, completed: false }], allComplete: true, chestClaimed: false },
      scoreDetail: { currentStreak: 5 },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current?.kind).toBe('icebreaker');
  });

  it('returns claim_chest when the board is fully complete and the chest is unclaimed', () => {
    setAllSources({ board: { quests: [], allComplete: true, chestClaimed: false } });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'claim_chest' });
  });

  it('does not return claim_chest once the chest has already been claimed', () => {
    setAllSources({ board: { quests: [], allComplete: true, chestClaimed: true } });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('claim_chest outranks quest_progress and streak', () => {
    setAllSources({
      board: { quests: [{ progress: 1, target: 4, completed: false }], allComplete: true, chestClaimed: false },
      scoreDetail: { currentStreak: 5 },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'claim_chest' });
  });

  it('picks the quest closest to completion by progress/target ratio, not list order', () => {
    setAllSources({
      board: {
        allComplete: false,
        chestClaimed: false,
        quests: [
          { questId: 'a', progress: 1, target: 4, completed: false }, // 25%
          { questId: 'b', progress: 3, target: 4, completed: false }, // 75%
          { questId: 'c', progress: 1, target: 10, completed: false }, // 10%
        ],
      },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'quest_progress', progress: 3, target: 4 });
  });

  it('excludes already-completed quests from quest_progress selection', () => {
    setAllSources({
      board: {
        allComplete: false,
        chestClaimed: false,
        quests: [
          { questId: 'done', progress: 4, target: 4, completed: true },
          { questId: 'live', progress: 1, target: 4, completed: false },
        ],
      },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'quest_progress', progress: 1, target: 4 });
  });

  it('excludes quests with no target (target 0 or missing) from selection', () => {
    setAllSources({
      board: {
        allComplete: false,
        chestClaimed: false,
        quests: [{ questId: 'broken', progress: 1, target: 0, completed: false }],
      },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toBeNull();
  });

  it('quest_progress outranks streak', () => {
    setAllSources({
      board: { allComplete: false, chestClaimed: false, quests: [{ progress: 1, target: 4, completed: false }] },
      scoreDetail: { currentStreak: 5 },
    });
    const { result } = renderHook(() => useNextAction());
    expect(result.current?.kind).toBe('quest_progress');
  });

  it('returns streak as the last resort when a streak is active', () => {
    setAllSources({ scoreDetail: { currentStreak: 3 } });
    const { result } = renderHook(() => useNextAction());
    expect(result.current).toEqual({ kind: 'streak', days: 3 });
  });

  it('returns null when the streak is zero or missing', () => {
    setAllSources({ scoreDetail: { currentStreak: 0 } });
    const { result: zero } = renderHook(() => useNextAction());
    expect(zero.current).toBeNull();

    setAllSources({ scoreDetail: {} });
    const { result: missing } = renderHook(() => useNextAction());
    expect(missing.current).toBeNull();
  });
});
