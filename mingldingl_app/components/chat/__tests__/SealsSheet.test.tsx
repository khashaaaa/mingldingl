import { render, fireEvent } from '@testing-library/react-native';
import { SealsSheet } from '../SealsSheet';
import type { PartialUser } from '../../../models/match';
import { hydrateRevealThresholds, resetRevealThresholdsForTests } from '../../../lib/reveal';
import { i18n } from '../../../lib/i18n';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

/**
 * Ported from the deleted `RevealStrip.test.tsx` (see git history): same fixtures, same
 * behaviours, now against a sheet rather than an inline strip, with the seal copy in place of the
 * old reveal-strip strings.
 */
describe('SealsSheet', () => {
  const freshMatch: PartialUser = { displayName: 'Riley', firstPhoto: 'https://x/1.jpg' };
  const onClose = jest.fn();
  beforeEach(() => {
    resetRevealThresholdsForTests();
    mockPush.mockClear();
    onClose.mockClear();
  });

  it('reads the next reveal from the engine ladder once it is hydrated', () => {
    hydrateRevealThresholds([
      { level: 1, messages: 1 }, { level: 2, messages: 8 }, { level: 3, messages: 15 }, { level: 4, messages: 30 },
    ]);

    const { getByText } = render(
      <SealsSheet visible onClose={onClose} otherUser={freshMatch} messageCount={0} revealLevel={1} />,
    );

    expect(getByText(i18n.t('seals_next_at', { count: 8 }))).toBeTruthy();
  });

  it('shows the first photo and wax placeholders for the rest on a fresh match', () => {
    const { getByTestId, queryByTestId, getByText, getAllByLabelText } = render(
      <SealsSheet visible onClose={onClose} otherUser={freshMatch} messageCount={0} revealLevel={1} />,
    );

    expect(getByTestId('seal-photo-0')).toBeTruthy();
    expect(getByTestId('seal-photo-wax-1')).toBeTruthy();
    expect(getByTestId('seal-photo-wax-2')).toBeTruthy();
    expect(queryByTestId('seal-photo-1')).toBeNull();
    // 2 wax photos + 3 wax chips (age, district, deep — none earned yet).
    expect(getAllByLabelText(i18n.t('seal_under_wax'))).toHaveLength(5);
    expect(getByText('Age')).toBeTruthy();
    expect(getByText('District')).toBeTruthy();
    expect(getByText('Deep profile')).toBeTruthy();
    expect(getByText(i18n.t('seals_next_at', { count: 5 }))).toBeTruthy();
  });

  it('does not put a wax seal on a photo slot the other person will never fill', () => {
    // photoCount is what the engine says they actually have. Without it a two-photo profile shows
    // a wax third slot that no amount of conversation can ever resolve.
    const { queryByTestId, getByTestId } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{ ...freshMatch, secondPhoto: 'https://x/2.jpg', photoCount: 2 }}
        messageCount={7}
        revealLevel={1}
      />,
    );

    expect(getByTestId('seal-photo-1')).toBeTruthy();
    expect(queryByTestId('seal-photo-wax-2')).toBeNull();
  });

  it('still puts a wax seal on a slot that exists but has not been earned yet', () => {
    const { getByTestId } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{ ...freshMatch, photoCount: 3 }}
        messageCount={0}
        revealLevel={1}
      />,
    );

    expect(getByTestId('seal-photo-wax-1')).toBeTruthy();
    expect(getByTestId('seal-photo-wax-2')).toBeTruthy();
  });

  it('renders revealed age/district values and the second photo at the mid stage', () => {
    const { getByTestId, getByText, queryByText } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{ ...freshMatch, secondPhoto: 'https://x/2.jpg', age: 33, district: 'Sükhbaatar' }}
        messageCount={7}
        revealLevel={3}
      />,
    );

    expect(getByTestId('seal-photo-1')).toBeTruthy();
    expect(getByTestId('seal-photo-wax-2')).toBeTruthy();
    expect(getByText('33 winters')).toBeTruthy();
    expect(getByText('District: Sükhbaatar')).toBeTruthy();
    expect(queryByText('Age')).toBeNull();
    // Eyebrow reads "Two of three seals broken" — CardEyebrow renders it upper-cased.
    expect(getByText(i18n.t('seals_broken_2').toUpperCase())).toBeTruthy();
    expect(getByText(i18n.t('seals_next_at', { count: 15 }))).toBeTruthy();
  });

  it('renders deep fields through the habit/religion/lifestyle i18n families once fully revealed', () => {
    const { getByText, queryByText } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{
          ...freshMatch,
          secondPhoto: 'https://x/2.jpg',
          thirdPhoto: 'https://x/3.jpg',
          age: 31,
          district: 'Khan-Uul',
          deep: { hasKids: false, smokingHabit: 'Never', drinkingHabit: 'Occasionally', religion: 'Buddhist', lifestyle: null },
        }}
        messageCount={42}
        revealLevel={4}
      />,
    );

    expect(getByText('Have kids: No')).toBeTruthy();
    expect(getByText('Smoking: Never')).toBeTruthy();
    expect(getByText('Drinking: Occasionally')).toBeTruthy();
    expect(getByText('Religion: Buddhist')).toBeTruthy();
    expect(queryByText(/Lifestyle/)).toBeNull();
    expect(queryByText('Deep profile')).toBeNull();
    expect(getByText(i18n.t('seals_left_0'))).toBeTruthy();
  });

  it('offers the membership upsell instead of a padlock when the deep gate is the paywall', () => {
    const { queryByText, getByText, getByTestId } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{ ...freshMatch, age: 31, district: 'Khan-Uul', deep: null }}
        messageCount={60}
        revealLevel={4}
      />,
    );

    // The conversation already earned the top rung, so the padlocked "Deep profile" chip would be a
    // lie — the only thing still holding it back is the membership tier.
    expect(queryByText('Deep profile')).toBeNull();
    expect(getByText(i18n.t('seals_deep_membership'))).toBeTruthy();

    fireEvent.press(getByText(i18n.t('seals_climb')));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/membership');
    expect(getByTestId('seals-climb')).toBeTruthy();
  });

  it('keeps the plain padlock while the deep rung is still unearned', () => {
    const { queryByTestId, getByText } = render(
      <SealsSheet visible onClose={onClose} otherUser={{ ...freshMatch, age: 31 }} messageCount={16} revealLevel={3} />,
    );

    expect(getByText('Deep profile')).toBeTruthy();
    expect(queryByTestId('seals-climb')).toBeNull();
  });

  it('shows no upsell once the deep fields have actually arrived', () => {
    const { queryByTestId, getByText } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{
          ...freshMatch,
          deep: { hasKids: false, smokingHabit: 'Never', drinkingHabit: null, religion: null, lifestyle: null },
        }}
        messageCount={60}
        revealLevel={4}
      />,
    );

    expect(getByText('Smoking: Never')).toBeTruthy();
    expect(queryByTestId('seals-climb')).toBeNull();
  });

  it('treats the top of the hydrated ladder as the deep rung, not a hardcoded 4', () => {
    // The ladder is admin-tunable and served by the engine; pinning the deep level in the app meant
    // a shortened ladder would never show the membership upsell at its own top rung.
    hydrateRevealThresholds([
      { level: 1, messages: 1 }, { level: 2, messages: 5 }, { level: 3, messages: 9 }, { level: 4, messages: 12 },
    ]);

    const { getByTestId } = render(
      <SealsSheet
        visible
        onClose={onClose}
        otherUser={{ ...freshMatch, photoCount: 3, age: 27, district: 'Sükhbaatar' }}
        messageCount={12}
        revealLevel={4}
      />,
    );

    expect(getByTestId('seals-climb')).toBeTruthy();
  });

  it('always states the law that only mutual letters count', () => {
    const { getByText } = render(
      <SealsSheet visible onClose={onClose} otherUser={freshMatch} messageCount={0} revealLevel={1} />,
    );

    expect(getByText(i18n.t('seals_law'))).toBeTruthy();
  });
});
