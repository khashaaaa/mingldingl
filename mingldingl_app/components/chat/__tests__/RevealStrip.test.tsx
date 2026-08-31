import { render } from '@testing-library/react-native';
import { RevealStrip, nextRevealThreshold } from '../RevealStrip';
import type { PartialUser } from '../../../models/match';

describe('nextRevealThreshold', () => {
  it.each([[0, 5], [4, 5], [5, 15], [14, 15], [15, 30], [29, 30], [30, null], [100, null]])(
    'messageCount %i → next reveal at %p', (count, expected) => {
      expect(nextRevealThreshold(count)).toBe(expected);
    });
});

describe('RevealStrip', () => {
  const freshMatch: PartialUser = { displayName: 'Riley', firstPhoto: 'https://x/1.jpg' };

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
});
