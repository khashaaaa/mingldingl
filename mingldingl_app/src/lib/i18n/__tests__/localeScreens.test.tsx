import fs from 'node:fs';
import path from 'node:path';
import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { setLocale, t } from '../index';
import { localeScreenLayout } from '../LocaleScreens';

afterEach(() => setLocale('en'));

test('a language switch redraws open screens, nested ones too, and keeps where you are', async () => {
  const view = renderRouter(
    {
      _layout: () => <Stack screenLayout={localeScreenLayout} screenOptions={{ headerShown: false }} />,
      '(world)/_layout': () => (
        <Stack screenLayout={localeScreenLayout} screenOptions={{ headerShown: false }} />
      ),
      '(world)/(tabs)/_layout': () => <Tabs screenLayout={localeScreenLayout} initialRouteName="character" />,
      '(world)/(tabs)/character': () => <Text>{t('room.character')}</Text>,
      '(world)/(tabs)/seek': () => <Text>{t('room.tavern')}</Text>,
    },
    { initialUrl: '/character' },
  );
  await view;
  jest.useRealTimers();
  await act(async () => router.navigate('/seek'));
  expect(screen.getByText('The Tavern')).toBeTruthy();

  await act(async () => setLocale('pseudo'));
  expect(screen.queryByText('The Tavern')).toBeNull();
  expect(view.getPathname()).toBe('/seek');
});

test('every navigator in the app takes the locale layout', () => {
  const src = path.join(__dirname, '..', '..', '..');
  const navigators: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name) && /<(Stack|Tabs)\b/.test(fs.readFileSync(p, 'utf8')))
        navigators.push(p);
    }
  };
  walk(path.join(src, 'app'));
  walk(path.join(src, 'features'));
  expect(navigators.length).toBeGreaterThanOrEqual(4);
  for (const p of navigators)
    expect({
      p: path.relative(src, p),
      // roomLayout (the world stack's) and tabLayout (the tabs') wrap localeScreenLayout.
      ok: /screenLayout=\{(localeScreenLayout|roomLayout|tabLayout)\}/.test(fs.readFileSync(p, 'utf8')),
    }).toEqual({
      p: path.relative(src, p),
      ok: true,
    });
});
