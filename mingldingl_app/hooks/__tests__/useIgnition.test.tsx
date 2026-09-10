import { renderHook } from '@testing-library/react-native';
import { useIgnition } from '../useIgnition';

describe('useIgnition', () => {
  it('records the first list silently, however much it already holds', () => {
    // Walking into a hall with three lit honours is not three ceremonies.
    const { result } = renderHook(() => useIgnition(['title_oathkeeper', 'title_flamekeeper', 'title_sevendawns']));
    expect(result.current).toEqual([]);
  });

  it('reports an honour that arrives while it is watching', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useIgnition(ids),
      { initialProps: { ids: ['title_oathkeeper'] as string[] } },
    );
    rerender({ ids: ['title_oathkeeper', 'title_sevendawns'] });
    expect(result.current).toEqual(['title_sevendawns']);
  });

  it('keeps an ignited honour ignited across later renders', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useIgnition(ids),
      { initialProps: { ids: [] as string[] } },
    );
    rerender({ ids: ['title_trueword'] });
    rerender({ ids: ['title_trueword'] });
    expect(result.current).toEqual(['title_trueword']);
    rerender({ ids: ['title_trueword', 'title_allycaller'] });
    expect(result.current).toEqual(['title_trueword', 'title_allycaller']);
  });

  it('waits for the inventory rather than treating "still loading" as "holds nothing"', () => {
    // An empty list read while loading would ignite every honour the moment the real one landed.
    const { result, rerender } = renderHook(
      ({ ids }) => useIgnition(ids),
      { initialProps: { ids: undefined as string[] | undefined } },
    );
    rerender({ ids: ['title_oathkeeper', 'title_bondkeeper'] });
    expect(result.current).toEqual([]);
    rerender({ ids: ['title_oathkeeper', 'title_bondkeeper', 'title_fateseer'] });
    expect(result.current).toEqual(['title_fateseer']);
  });

  it('says nothing when an honour disappears', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useIgnition(ids),
      { initialProps: { ids: ['title_oathkeeper', 'title_flamekeeper'] as string[] } },
    );
    rerender({ ids: ['title_oathkeeper'] });
    expect(result.current).toEqual([]);
  });
});
