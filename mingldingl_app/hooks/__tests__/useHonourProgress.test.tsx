import { renderHook } from '@testing-library/react-native';
import { useHonourProgress } from '../useHonourProgress';

const mockScore: { data: Record<string, unknown> | undefined } = { data: undefined };
const mockProfile: { data: Record<string, unknown> | null | undefined } = { data: undefined };
jest.mock('../useScoreDetail', () => ({ useScoreDetail: () => mockScore }));
jest.mock('../useProfile', () => ({ useProfile: () => mockProfile }));

describe('useHonourProgress', () => {
  beforeEach(() => {
    mockScore.data = undefined;
    mockProfile.data = undefined;
  });

  it('reports nothing until the figures have arrived', () => {
    const { result } = renderHook(() => useHonourProgress());
    expect(result.current).toEqual({});
  });

  it('counts the login streak toward Seven Dawns, capped at seven', () => {
    mockScore.data = { currentStreak: 4 };
    const { result } = renderHook(() => useHonourProgress());
    expect(result.current.title_sevendawns).toEqual({ held: 4, needed: 7 });

    mockScore.data = { currentStreak: 12 };
    expect(renderHook(() => useHonourProgress()).result.current.title_sevendawns).toEqual({ held: 7, needed: 7 });
  });

  it('counts sparked threads toward all three thread honours', () => {
    mockScore.data = { threadsSparked: 3 };
    const { result } = renderHook(() => useHonourProgress());
    expect(result.current.title_threadweaver).toEqual({ held: 1, needed: 1 });
    expect(result.current.title_fateseer).toEqual({ held: 3, needed: 5 });
    expect(result.current.title_bondkeeper).toEqual({ held: 3, needed: 10 });
  });

  it('leaves the thread honours out when the engine has not sent the count yet', () => {
    // An older engine without `threadsSparked` must not show every thread honour as 0 of N.
    mockScore.data = { currentStreak: 1 };
    const { result } = renderHook(() => useHonourProgress());
    expect(result.current.title_threadweaver).toBeUndefined();
    expect(result.current.title_fateseer).toBeUndefined();
  });

  it('counts oath encounters only once an oath is sworn', () => {
    mockProfile.data = { oath: null, oathEncountersHeld: 2, oathEncountersNeeded: 3 };
    expect(renderHook(() => useHonourProgress()).result.current.title_oathkeeper).toBeUndefined();

    mockProfile.data = { oath: 'Honesty', oathEncountersHeld: 2, oathEncountersNeeded: 3 };
    expect(renderHook(() => useHonourProgress()).result.current.title_oathkeeper).toEqual({ held: 2, needed: 3 });
  });

  it('never reports the honours the app cannot count', () => {
    mockScore.data = { currentStreak: 2, threadsSparked: 0 };
    mockProfile.data = { oath: 'Honesty', oathEncountersHeld: 0, oathEncountersNeeded: 3 };
    const { result } = renderHook(() => useHonourProgress());
    for (const id of ['title_flamekeeper', 'title_sealbreaker', 'title_allycaller', 'title_trueword'] as const) {
      expect(result.current[id]).toBeUndefined();
    }
  });
});
