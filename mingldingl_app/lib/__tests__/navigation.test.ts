import path from 'path';
import { backToChat, goBack, goHome, goTo, hrefPath, isTabRoute, stackHas } from '../navigation';
import { appSources } from '../testing/sourceTree';

function router(canGoBack = true) {
  return { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn(), canGoBack: () => canGoBack } as never as
    Parameters<typeof goTo>[0] & Record<'push' | 'back' | 'replace' | 'dismiss' | 'dismissTo', jest.Mock>;
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

  // The stack as expo-router nests it: everything sits under `__root`.
  const open = (...routes: { name: string; params?: object }[]) => ({
    routes: [{ name: '__root', state: { index: routes.length, routes: [{ name: '(tabs)' }, ...routes] } }],
  });

  it('returns to a screen already open further down instead of stacking a copy', () => {
    const r = router();
    goTo(r, '/progression', open({ name: 'progression' }, { name: 'leaderboard' }));
    expect(r.dismiss).toHaveBeenCalledWith(1);
    expect(r.push).not.toHaveBeenCalled();
  });

  // `dismissTo` stops at the nearest route of the same *name*: from chat m1 under chat m2 it
  // stopped at m2 and relabelled it m1, leaving two copies of the one chat.
  it('returns to the very chat it names, past another chat of the same screen', () => {
    const r = router();
    goTo(r, '/chat/m1', open(
      { name: 'chat/[matchId]', params: { matchId: 'm1' } },
      { name: 'chat/[matchId]', params: { matchId: 'm2' } },
      { name: 'quiz/[matchId]', params: { matchId: 'm2' } },
    ));
    expect(r.dismiss).toHaveBeenCalledWith(2);
    expect(r.dismissTo).not.toHaveBeenCalled();
  });

  it('does nothing for the screen already on top', () => {
    const r = router();
    goTo(r, '/chat/m1', open({ name: 'chat/[matchId]', params: { matchId: 'm1' } }));
    expect(r.dismiss).not.toHaveBeenCalled();
    expect(r.push).not.toHaveBeenCalled();
  });

  it('still pushes the same screen for a different subject', () => {
    const r = router();
    goTo(r, '/chat/m2', open({ name: 'chat/[matchId]', params: { matchId: 'm1' } }));
    expect(r.push).toHaveBeenCalledWith('/chat/m2');
  });

  it('matches an object href by the path it fills in', () => {
    expect(hrefPath({ pathname: '/chat/[matchId]', params: { matchId: 'm1', name: 'x' } })).toBe('/chat/m1');
    expect(hrefPath('/business/7?from=board')).toBe('/business/7');
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
  const stack = (...routes: { name: string; params?: object }[]) =>
    ({ index: routes.length - 1, routes });
  const quiz = { name: 'quiz/[matchId]', params: { matchId: 'm1' } };

  it('goes back when the chat or the campaign opened this page', () => {
    for (const name of ['chat/[matchId]', 'campaign/[matchId]']) {
      const r = router();
      backToChat(r, stack({ name: '(tabs)' }, { name, params: { matchId: 'm1' } }, quiz), 'm1');
      expect(r.back).toHaveBeenCalled();
    }
  });

  it('opens the chat when a notification opened this page over the tabs', () => {
    const r = router();
    backToChat(r, stack({ name: '(tabs)' }, quiz), 'm1');
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith('/chat/m1');
  });

  it('returns to the chat already open further down rather than replacing in a second', () => {
    const r = router();
    backToChat(r, stack({ name: '(tabs)' }, { name: 'chat/[matchId]', params: { matchId: 'm1' } }, { name: 'progression' }, quiz), 'm1');
    expect(r.dismiss).toHaveBeenCalledWith(2);
    expect(r.replace).not.toHaveBeenCalled();
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

  // A replace from a screen stacked above the tabs swaps that screen for a *second* tab navigator.
  // Only the auth gate may, as it replaces the auth or onboarding stack that has no tabs beneath.
  it('never replaces in a tab route, which also stacks a second tab bar', () => {
    const hits = sources.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) =>
        /router\.replace\(\s*['"`]\/\(tabs\)/.test(line) && f.rel !== path.join('app', '_layout.tsx') ? [`${f.rel}:${i + 1}`] : []));
    expect(hits).toEqual([]);
  });

  // `useGoTo` returns to a screen already open; a bare push stacks a second copy of it. The phone
  // screen's push to its own code step is the one push that can never meet itself.
  it('never pushes a screen directly, which stacks copies of screens already open', () => {
    const hits = sources.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) =>
        /\brouter\.push\(/.test(line) && f.rel !== path.join('app', '(auth)', 'phone.tsx') ? [`${f.rel}:${i + 1}`] : []));
    expect(hits).toEqual([]);
  });

  it('never calls a bare router.back(), which does nothing with no history', () => {
    const hits = sources.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) => (/\brouter\.back\(\)/.test(line) ? [`${f.rel}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });
});
