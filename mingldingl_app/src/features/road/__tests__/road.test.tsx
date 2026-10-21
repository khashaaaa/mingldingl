import { fireEvent, render, screen } from '@testing-library/react-native';
import { DawnStreak } from '@/design/components/DawnStreak';
import { HonourCell } from '@/design/components/HonourCell';
import { QuestTile } from '@/design/components/QuestTile';
import { setLocale, tCount } from '@/lib/i18n';
import en from '@/lib/i18n/en.json';
import { moonLine } from '../../common/time';
import { skyPhase } from '../Hearth';
import { emblem, honourText } from '../honours';
import { QUEST } from '../quests';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
afterEach(() => setLocale('en'));

const KEYS = [
  'sealBreaker',
  'flamekeeper',
  'sevenDawns',
  'allyCaller',
  'trueToWord',
  'threadWeaver',
  'mended',
  'cartographer',
  'bondKeeper',
  'oathKeeper',
  'fateSeer',
  'hearthbound',
  'naadam',
  'tsagaanSar',
  'firstBond',
  'iceBroken',
  'firstTrial',
  'tenWords',
  'firstPledge',
  'faceToFlame',
  'oathFulfilled',
];

describe('the road', () => {
  test('every honour the engine names has an emblem and all four lines', () => {
    for (const k of KEYS) {
      expect(emblem(k)).not.toBe('honour_locked');
      for (const part of ['name', 'did', 'for', 'line'] as const)
        expect(honourText(k, part) in en).toBe(true);
    }
  });

  test('every quest kind has a glyph and a name', () => {
    for (const k of [
      'lightHearth',
      'answerLetters',
      'firstLetter',
      'summon',
      'breakIce',
      'takeTrial',
      'keepEncounter',
      'lightRite',
      'breakSeal',
    ])
      expect(QUEST[k]?.title && QUEST[k].title in en).toBe(true);
  });

  test('a claimable quest claims on a tap; an active one does not', async () => {
    const claim = jest.fn();
    const { rerender } = await render(
      <QuestTile
        glyph="hearth"
        title="Light the hearth"
        progressText="Done"
        progress={1}
        reward="+20"
        state="claimable"
        onClaim={claim}
      />,
    );
    await fireEvent.press(screen.getByRole('button'));
    expect(claim).toHaveBeenCalledTimes(1);
    await rerender(
      <QuestTile
        glyph="letters"
        title="Answer"
        progressText="2 of 3"
        progress={0.6}
        reward="+30"
        state="active"
        onClaim={claim}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('the dawn row says how many burn; a locked honour has no name and cannot open', async () => {
    await render(<DawnStreak lit={3} line={tCount('missions.dawns', 3)} />);
    expect(screen.getByText('3 dawns burning')).toBeTruthy();
    await render(<HonourCell emblem="honour_mended" name="Mended" earned={false} onPress={jest.fn()} />);
    expect(screen.getByText('???')).toBeTruthy();
    expect(screen.queryByText('MENDED')).toBeNull();
  });

  test('counted lines pick one or many, and the sky follows the Ulaanbaatar hour', () => {
    expect(tCount('missions.dawns', 1)).toBe('1 dawn burning');
    expect(tCount('log.scarsOpen', 2)).toMatch(/^2 open/);
    const ub = (h: number) => Date.UTC(2026, 9, 10, h - 8 < 0 ? h + 16 : h - 8);
    expect(skyPhase(ub(3))).toBe('night');
    expect(skyPhase(ub(6))).toBe('dawn');
    expect(skyPhase(ub(12))).toBe('day');
    expect(skyPhase(ub(19))).toBe('dusk');
    expect(skyPhase(ub(22))).toBe('night');
  });

  test('a day in the world calendar', () => {
    expect(moonLine('honours.earnedOn', '2026-10-04T12:00:00')).toBe(
      'Earned on the 4th dawn of the tenth moon',
    );
    // in Mongolian the day is the bare number and the moon its Mongolian ordinal
    setLocale('mn');
    expect(moonLine('honours.earnedOn', '2026-10-04T12:00:00')).toBe('Хүртсэн өдөр: аравдугаар сарын 4');
    setLocale('en');
  });
});
