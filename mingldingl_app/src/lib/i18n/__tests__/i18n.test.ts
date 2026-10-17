import en from '../en.json';
import { pseudo, setLocale, t, tError } from '../index';
import mn from '../mn.json';

// names, numbers, bare placeholders: lines that are legitimately identical
const SAME_IN_BOTH: string[] = [
  'app.name',
  'phone.placeholder',
  'character.nameAge',
  'seek.nameAge',
  'seek.tierPlace',
  'quests.quote',
  'nudge.reward',
  'step.meetingSworn.body',
  'war.sigilValue',
  'chest.points',
  'log.row',
  'square.meta',
  'filters.age18',
  'filters.age25',
  'filters.age35',
  'filters.age45',
];

afterEach(() => setLocale('en'));

test('every English key has its Mongolian line, and no Mongolian line is orphaned', () => {
  expect(Object.keys(mn).sort()).toEqual(Object.keys(en).sort());
});

test('no Mongolian line is a copy of the English one', () => {
  for (const [k, v] of Object.entries(mn))
    if (!SAME_IN_BOTH.includes(k)) expect(v).not.toBe((en as Record<string, string>)[k]);
});

test('every Mongolian line keeps the English placeholders', () => {
  const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
  for (const [k, v] of Object.entries(mn))
    expect(vars(v)).toEqual(vars((en as Record<string, string>)[k] ?? ''));
});

test('interpolation fills {{vars}}', () => {
  expect(t('photos.counter', { have: 2, need: 3, max: 6 })).toBe('2 of 3 needed · up to 6');
});

test('pseudo-Mongolian is about 1.4x longer and Cyrillic', () => {
  const s = 'Prove your number';
  const p = pseudo(s);
  expect(p.length).toBeGreaterThanOrEqual(Math.floor(s.length * 1.4));
  expect(p).toMatch(/[А-Яа-яӨөҮү]/);
});

test('pseudo keeps placeholders intact', () => {
  setLocale('pseudo');
  expect(t('photos.counter', { have: 1, need: 3, max: 6 })).toMatch(/1.*3.*6/);
});

test('an engine rule shows its own line when the app has one, else the engine text', () => {
  expect(tError('profile.name', 'Enter your name')).toBe(t('error.profile.name'));
  expect(tError('something.new', 'As the engine says')).toBe('As the engine says');
  setLocale('pseudo');
  expect(tError('profile.name', 'Enter your name')).toBe(t('error.profile.name'));
});

test('a composed line takes its pieces in its own language', () => {
  const { setLocale, tLine } = require('../index');
  setLocale('mn');
  expect(tLine('ceremony.tierTitle', { tier: 'tier.Opal' })).toBe('Солонго зэрэгт өгслөө');
  setLocale('en');
  expect(tLine('ceremony.tierTitle', { tier: 'tier.Opal' })).toBe('Ascended to Opal');
});
