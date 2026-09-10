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

describe('ScoreHistoryList', () => {
  // Each row is a saga line with the signed delta folded into the sentence, a small-caps
  // dateline beneath it, and the bare number kept at the right so totals can still be scanned.
  it('tells a mapped event as a saga line with the delta substituted', () => {
    const { getByText } = renderList(['DailyLogin']);
    expect(getByText('The wanderer returned at dawn, +5')).toBeTruthy();
    expect(getByText('+5')).toBeTruthy();
    expect(getByText('Sep 1, 2026')).toBeTruthy();
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
});
