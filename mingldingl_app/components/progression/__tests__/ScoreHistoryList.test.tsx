import { render } from '@testing-library/react-native';
import {
  ScoreHistoryList, ENGINE_EVENT_TYPES, EVENT_TYPE_KEYS, EVENT_ICONS, CHRONICLE_KEYS,
} from '../ScoreHistoryList';
import { translations } from '../../../lib/i18n';

const noop = () => {};
// Noon UTC so the dateline reads "Sep 1" in every timezone the suite might run in.
const event = (eventType: string) => ({
  eventType,
  delta: 5,
  createdAt: '2026-09-01T12:00:00Z',
});

function renderList(eventTypes: string[]) {
  return render(
    <ScoreHistoryList
      items={eventTypes.map(event)}
      onEndReached={noop}
      isFetchingNextPage={false}
    />,
  );
}

// Local instants only (never a UTC literal read back as local) — Sep 13 and Sep 12, 2026, ten
// local days after a Sep 3 join, so `threadDay` lands on 11 and 10 and stays inside
// `ordinalWord`'s worded range (1-12) regardless of whether Task 5's numeral-fallback fix has
// landed yet.
const JOINED_AT = new Date(2026, 8, 3, 9).toISOString();
const TODAY_EARLY = new Date(2026, 8, 13, 10).toISOString();
const TODAY_LATE = new Date(2026, 8, 13, 16).toISOString();
const YESTERDAY = new Date(2026, 8, 12, 9).toISOString();

// The feed comes back newest first, so the two "today" events sit above yesterday's.
const TWO_DAY_ITEMS = [
  { eventType: 'QuizDone', delta: 5, createdAt: TODAY_LATE },
  { eventType: 'DailyLogin', delta: 5, createdAt: TODAY_EARLY },
  { eventType: 'FirstMessage', delta: 5, createdAt: YESTERDAY },
];

/** Every string leaf in a rendered tree, in document order — the only way to assert that one
 *  section heading comes before another rather than merely that both exist. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (Array.isArray(node)) { node.forEach((child) => collectText(child, out)); return out; }
  if (typeof node === 'string') { out.push(node); return out; }
  if (typeof node === 'object' && node && 'children' in node) {
    collectText((node as { children: unknown }).children, out);
  }
  return out;
}

describe('ScoreHistoryList', () => {
  // Each row is a saga line with the signed delta folded into the sentence, its day named by the
  // section heading above it (an uppercase eyebrow, absent a `joinedAt`), and the bare number kept
  // at the right so totals can still be scanned.
  it('tells a mapped event as a saga line with the delta substituted', () => {
    const { getByText } = renderList(['DailyLogin']);
    expect(getByText('The wanderer returned at dawn, +5')).toBeTruthy();
    expect(getByText('+5')).toBeTruthy();
    expect(getByText('SEP 1, 2026')).toBeTruthy();
  });

  it('writes a loss with a true minus sign', () => {
    const { getByText } = render(
      <ScoreHistoryList
        items={[{ eventType: 'GhostPenalty', delta: -15, createdAt: '2026-09-01T12:00:00Z' }]}
        onEndReached={noop}
        isFetchingNextPage={false}
      />,
    );
    expect(getByText('A silence fell, and the hold took its due, −15')).toBeTruthy();
    expect(getByText('-15')).toBeTruthy();
  });

  // The Campaign awards these two; they were shipped without labels and rendered as
  // i18n-js's `[missing "en.CampaignRoomBonus" translation]` marker.
  it('tells the campaign awards the engine emits', () => {
    const { getByText } = renderList(['CampaignRoomBonus', 'CampaignBossBonus']);
    expect(getByText('A chamber of the deep was cleared, +5')).toBeTruthy();
    expect(getByText('The seal of the deep was broken, +5')).toBeTruthy();
  });

  it('gives every event type the engine can write a saga line in both locales', () => {
    const missing: string[] = [];
    for (const type of [...ENGINE_EVENT_TYPES, 'ReportPenalty']) {
      const key = CHRONICLE_KEYS[type];
      if (!key) { missing.push(type); continue; }
      for (const locale of ['en', 'mn'] as const) {
        const line = (translations[locale] as Record<string, string>)[key];
        if (!line || !line.includes('%{delta}')) missing.push(`${locale}.${type}`);
      }
    }
    expect(missing).toEqual([]);
  });

  // The engine and this list have no shared schema, so nothing but a test keeps them in step.
  // OathProven (+40) and RepeatedNoShowPenalty both shipped without labels and rendered to
  // users as their raw camelCase identifiers, in both languages.
  it('labels every event type the engine can write', () => {
    const unlabelled = ENGINE_EVENT_TYPES.filter((type) => {
      const { queryByText } = renderList([type]);
      return queryByText(type) !== null;
    });
    expect(unlabelled).toEqual([]);
  });

  it('resolves every label to a real string in both locales', () => {
    const missing: string[] = [];
    for (const type of ENGINE_EVENT_TYPES) {
      for (const locale of ['en', 'mn'] as const) {
        const key = EVENT_TYPE_KEYS[type];
        if (!key || !(key in translations[locale])) missing.push(`${locale}.${type}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('gives every labelled event type an icon', () => {
    const iconless = Object.keys(EVENT_TYPE_KEYS).filter((type) => !(type in EVENT_ICONS));
    expect(iconless).toEqual([]);
  });

  // A new engine-side event type must degrade to its raw identifier rather than leaking the
  // missing-translation marker to the user.
  it('falls back to the raw identifier for an unmapped event type', () => {
    const { getByText, queryByText } = renderList(['SomeFutureAward']);
    expect(getByText('SomeFutureAward')).toBeTruthy();
    expect(queryByText(/missing/)).toBeNull();
  });

  // The chronicle is now a SectionList grouped by local day, one heading per day rather than a
  // dateline per row.
  describe('grouped by dawn', () => {
    it('headings the days as dawns counted from joinedAt, most recent day first', () => {
      const { getByText, toJSON } = render(
        <ScoreHistoryList
          items={TWO_DAY_ITEMS}
          onEndReached={noop}
          isFetchingNextPage={false}
          joinedAt={JOINED_AT}
        />,
      );
      expect(getByText('THE ELEVENTH DAWN')).toBeTruthy();
      expect(getByText('THE TENTH DAWN')).toBeTruthy();

      const texts = collectText(toJSON());
      const eleventh = texts.indexOf('THE ELEVENTH DAWN');
      const tenth = texts.indexOf('THE TENTH DAWN');
      expect(eleventh).toBeGreaterThanOrEqual(0);
      expect(tenth).toBeGreaterThan(eleventh);
    });

    it('headings the days by plain date when joinedAt is absent, as before', () => {
      const { getByText } = render(
        <ScoreHistoryList items={TWO_DAY_ITEMS} onEndReached={noop} isFetchingNextPage={false} />,
      );
      expect(getByText('SEP 13, 2026')).toBeTruthy();
      expect(getByText('SEP 12, 2026')).toBeTruthy();
    });

    it('keeps the footer spinner and onEndReached wiring intact under SectionList', () => {
      const onEndReached = jest.fn();
      const { getByTestId } = render(
        <ScoreHistoryList items={TWO_DAY_ITEMS} onEndReached={onEndReached} isFetchingNextPage />,
      );
      expect(getByTestId('waiting-candle')).toBeTruthy();
    });
  });
});
