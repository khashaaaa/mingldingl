import { render, fireEvent } from '@testing-library/react-native';
import { RevealStrip } from '../RevealStrip';
import type { PartialUser } from '../../../models/match';
import { hydrateRevealThresholds, resetRevealThresholdsForTests } from '../../../lib/reveal';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('RevealStrip', () => {
  const freshMatch: PartialUser = { displayName: 'Riley', firstPhoto: 'https://x/1.jpg' };
  beforeEach(() => {
    resetRevealThresholdsForTests();
    mockPush.mockClear();
  });

  it('reads the next reveal from the engine ladder once it is hydrated', () => {
    hydrateRevealThresholds([
      { level: 1, messages: 1 }, { level: 2, messages: 8 }, { level: 3, messages: 15 }, { level: 4, messages: 30 },
    ]);

    const { getByText } = render(<RevealStrip otherUser={freshMatch} messageCount={0} />);

    expect(getByText('Next reveal at 8 messages')).toBeTruthy();
  });

  it('shows the first photo and locked placeholders for the rest on a fresh match', () => {
    const { getByTestId, queryByTestId, getByText, getAllByLabelText } = render(
      <RevealStrip otherUser={freshMatch} messageCount={0} />,
    );

    expect(getByTestId('reveal-photo-0')).toBeTruthy();
    expect(getByTestId('reveal-photo-locked-1')).toBeTruthy();
    expect(getByTestId('reveal-photo-locked-2')).toBeTruthy();
    expect(queryByTestId('reveal-photo-1')).toBeNull();
    expect(getAllByLabelText('Locked')).toHaveLength(2);
    expect(getByText('Age')).toBeTruthy();
    expect(getByText('District')).toBeTruthy();
    expect(getByText('Deep profile')).toBeTruthy();
    expect(getByText('Next reveal at 5 messages')).toBeTruthy();
  });

  it('renders revealed age/district values and the second photo at the mid stage', () => {
    const { getByTestId, getByText, queryByText } = render(
      <RevealStrip otherUser={{ ...freshMatch, secondPhoto: 'https://x/2.jpg', age: 27, district: 'Sükhbaatar' }} messageCount={7} />,
    );

    expect(getByTestId('reveal-photo-1')).toBeTruthy();
    expect(getByTestId('reveal-photo-locked-2')).toBeTruthy();
    expect(getByText('Age: 27')).toBeTruthy();
    expect(getByText('District: Sükhbaatar')).toBeTruthy();
    expect(queryByText('Age')).toBeNull();
    expect(getByText('Next reveal at 15 messages')).toBeTruthy();
  });

  it('renders deep fields through the habit/religion/lifestyle i18n families once fully revealed', () => {
    const { getByText, queryByText } = render(
      <RevealStrip
        otherUser={{
          ...freshMatch,
          secondPhoto: 'https://x/2.jpg',
          thirdPhoto: 'https://x/3.jpg',
          age: 31,
          district: 'Khan-Uul',
          deep: { hasKids: false, smokingHabit: 'Never', drinkingHabit: 'Occasionally', religion: 'Buddhist', lifestyle: null },
        }}
        messageCount={42}
      />,
    );

    expect(getByText('Have kids: No')).toBeTruthy();
    expect(getByText('Smoking: Never')).toBeTruthy();
    expect(getByText('Drinking: Occasionally')).toBeTruthy();
    expect(getByText('Religion: Buddhist')).toBeTruthy();
    expect(queryByText(/Lifestyle/)).toBeNull();
    expect(queryByText('Deep profile')).toBeNull();
    expect(getByText('Fully revealed')).toBeTruthy();
  });
  it('offers the membership upsell instead of a padlock when the deep gate is the paywall', () => {
    const { getByTestId, queryByText, getByText } = render(
      <RevealStrip
        otherUser={{ ...freshMatch, age: 31, district: 'Khan-Uul', deep: null }}
        messageCount={60}
        revealLevel={4}
      />,
    );

    // The conversation already earned the top rung, so the padlocked "Deep profile" chip would be a
    // lie — the only thing still holding it back is the membership tier.
    expect(queryByText('Deep profile')).toBeNull();
    expect(getByText('Deep profile — Silver members')).toBeTruthy();

    fireEvent.press(getByTestId('reveal-deep-upgrade'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('keeps the plain padlock while the deep rung is still unearned', () => {
    const { queryByTestId, getByText } = render(
      <RevealStrip otherUser={{ ...freshMatch, age: 31 }} messageCount={16} revealLevel={3} />,
    );

    expect(getByText('Deep profile')).toBeTruthy();
    expect(queryByTestId('reveal-deep-upgrade')).toBeNull();
  });

  it('shows no upsell once the deep fields have actually arrived', () => {
    const { queryByTestId, getByText } = render(
      <RevealStrip
        otherUser={{
          ...freshMatch,
          deep: { hasKids: false, smokingHabit: 'Never', drinkingHabit: null, religion: null, lifestyle: null },
        }}
        messageCount={60}
        revealLevel={4}
      />,
    );

    expect(getByText('Smoking: Never')).toBeTruthy();
    expect(queryByTestId('reveal-deep-upgrade')).toBeNull();
  });
  describe('collapsed (how chat mounts it)', () => {
    it('keeps the progress line but drops the photos and chips until tapped', () => {
      const { queryByTestId, getByTestId, getByText } = render(
        <RevealStrip
          otherUser={{ ...freshMatch, secondPhoto: 'https://x/2.jpg', age: 27, district: 'Sükhbaatar' }}
          messageCount={7}
          defaultExpanded={false}
        />,
      );

      // The motivating half survives; the reference half is what was costing the thread its screen.
      expect(getByText('Next reveal at 15 messages')).toBeTruthy();
      expect(getByText('Revealed: 2 of 3 photos')).toBeTruthy();
      expect(queryByTestId('reveal-photo-0')).toBeNull();

      fireEvent.press(getByTestId('reveal-toggle'));

      expect(getByTestId('reveal-photo-0')).toBeTruthy();
      expect(getByText('Age: 27')).toBeTruthy();
    });

    it('collapses again on a second tap', () => {
      const { queryByTestId, getByTestId } = render(
        <RevealStrip otherUser={freshMatch} messageCount={0} defaultExpanded={false} />,
      );

      fireEvent.press(getByTestId('reveal-toggle'));
      expect(getByTestId('reveal-photo-0')).toBeTruthy();

      fireEvent.press(getByTestId('reveal-toggle'));
      expect(queryByTestId('reveal-photo-0')).toBeNull();
    });
  });

  it('does not padlock a photo slot the other person will never fill', () => {
    // photoCount is what the engine says they actually have. Without it a two-photo profile shows
    // a locked third slot and "2 of 3" that no amount of conversation can ever resolve.
    const { queryByTestId, getByTestId, getByText } = render(
      <RevealStrip
        otherUser={{ ...freshMatch, secondPhoto: 'https://x/2.jpg', photoCount: 2 }}
        messageCount={7}
      />,
    );

    expect(getByTestId('reveal-photo-1')).toBeTruthy();
    expect(queryByTestId('reveal-photo-locked-2')).toBeNull();
    fireEvent.press(getByTestId('reveal-toggle'));
    expect(getByText('Revealed: 2 of 2 photos')).toBeTruthy();
  });

  it('still padlocks a slot that exists but has not been earned yet', () => {
    const { getByTestId } = render(
      <RevealStrip otherUser={{ ...freshMatch, photoCount: 3 }} messageCount={0} />,
    );

    expect(getByTestId('reveal-photo-locked-1')).toBeTruthy();
    expect(getByTestId('reveal-photo-locked-2')).toBeTruthy();
  });

  it('treats the top of the hydrated ladder as the deep rung, not a hardcoded 4', () => {
    // The ladder is admin-tunable and served by the engine; pinning the deep level in the app meant
    // a shortened ladder would never show the membership upsell at its own top rung.
    hydrateRevealThresholds([
      { level: 1, messages: 1 }, { level: 2, messages: 5 }, { level: 3, messages: 9 }, { level: 4, messages: 12 },
    ]);

    const { getByTestId } = render(
      <RevealStrip
        otherUser={{ ...freshMatch, photoCount: 3, age: 27, district: 'Sükhbaatar' }}
        messageCount={12}
        revealLevel={4}
      />,
    );

    expect(getByTestId('reveal-deep-upgrade')).toBeTruthy();
  });
});
