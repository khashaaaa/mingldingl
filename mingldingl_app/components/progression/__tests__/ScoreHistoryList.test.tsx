import { render } from '@testing-library/react-native';
import { ScoreHistoryList } from '../ScoreHistoryList';

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

  // A new engine-side event type must degrade to its raw identifier rather than leaking the
  // missing-translation marker to the user.
  it('falls back to the raw identifier for an unmapped event type', () => {
    const { getByText, queryByText } = renderList(['SomeFutureAward']);
    expect(getByText('SomeFutureAward')).toBeTruthy();
    expect(queryByText(/missing/)).toBeNull();
  });
});
