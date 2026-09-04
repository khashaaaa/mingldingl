import { render } from '@testing-library/react-native';
import { ScoreHistoryList, ENGINE_EVENT_TYPES, EVENT_TYPE_KEYS, EVENT_ICONS } from '../ScoreHistoryList';
import { translations } from '../../../lib/i18n';

const noop = () => {};
const event = (eventType: string) => ({
  eventType,
  delta: 5,
  createdAt: '2026-09-01T00:00:00Z',
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
  it('labels a mapped event type', () => {
    const { getByText } = renderList(['DailyLogin']);
    expect(getByText('Daily Login')).toBeTruthy();
  });

  // The Campaign awards these two; they were shipped without labels and rendered as
  // i18n-js's `[missing "en.CampaignRoomBonus" translation]` marker.
  it('labels the campaign awards the engine emits', () => {
    const { getByText } = renderList(['CampaignRoomBonus', 'CampaignBossBonus']);
    expect(getByText('Campaign Room Cleared')).toBeTruthy();
    expect(getByText("Dragon's Threshold Cleared")).toBeTruthy();
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
