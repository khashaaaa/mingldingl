import path from 'path';
import { backToChat, goBack, goHome, goTo, isTabRoute, stackHas } from '../navigation';
import { appSources } from '../testing/sourceTree';

function router(canGoBack = true) {
  return { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => canGoBack } as never as
    Parameters<typeof goTo>[0] & Record<'push' | 'back' | 'replace' | 'dismissTo', jest.Mock>;
}

describe('goTo', () => {
  it('pops back to the tabs for a tab route instead of pushing a second tab bar', () => {
    const r = router();
    goTo(r, '/(tabs)/profile');
    expect(r.dismissTo).toHaveBeenCalledWith('/(tabs)/profile');
    expect(r.push).not.toHaveBeenCalled();
  });

  it('pushes anything that is not a tab', () => {
    const r = router();
    goTo(r, '/satchel');
    expect(r.push).toHaveBeenCalledWith('/satchel');
  });

  it('reads an object href by its pathname', () => {
    expect(isTabRoute({ pathname: '/(tabs)/matches' })).toBe(true);
    expect(isTabRoute({ pathname: '/chat/[matchId]', params: { matchId: 'm1' } })).toBe(false);
  });
});

describe('goHome', () => {
  it('returns to the hearth already open', () => {
    const r = router();
    goHome(r, true);
    expect(r.dismissTo).toHaveBeenCalledWith('/hearth');
  });

  it('opens one when there is none', () => {
    const r = router();
    goHome(r, false);
    expect(r.push).toHaveBeenCalledWith('/hearth');
  });
});

describe('stackHas', () => {
  it('finds a route nested under the __root wrapper', () => {
    const state = { routes: [{ name: '__root', state: { routes: [{ name: '(tabs)' }, { name: 'hearth' }] } }] };
    expect(stackHas(state, 'hearth')).toBe(true);
    expect(stackHas(state, 'satchel')).toBe(false);
    expect(stackHas(undefined, 'hearth')).toBe(false);
  });
});

describe('goBack', () => {
  it('goes back when there is somewhere to go', () => {
    const r = router(true);
    goBack(r);
    expect(r.back).toHaveBeenCalled();
  });

  it('lands on the tabs when opened with nothing beneath', () => {
    const r = router(false);
    goBack(r);
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/(tabs)/discover');
  });
});

describe('backToChat', () => {
  it('goes back when the chat or the campaign opened this page', () => {
    for (const previous of ['chat/[matchId]', 'campaign/[matchId]']) {
      const r = router();
      backToChat(r, previous, 'm1');
      expect(r.back).toHaveBeenCalled();
    }
  });

  it('opens the chat when a notification opened this page over the tabs', () => {
    const r = router();
    backToChat(r, '(tabs)', 'm1');
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/chat/m1');
  });
});

describe('the navigation rules hold across the app', () => {
  const sources = appSources().filter((f) => f.rel !== path.join('lib', 'navigation.ts'));

  it('never pushes a tab route, which stacks a second tab bar', () => {
    const hits = sources.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) =>
        /router\.(push|navigate)\(\s*['"`]\/\(tabs\)/.test(line) ? [`${f.rel}:${i + 1}`] : []));
    expect(hits).toEqual([]);
  });

  it('never calls a bare router.back(), which does nothing with no history', () => {
    const hits = sources.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) => (/\brouter\.back\(\)/.test(line) ? [`${f.rel}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });
});
