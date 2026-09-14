import { render } from '@testing-library/react-native';
import { Image } from 'react-native';
import { CharacterCard } from '../CharacterCard';

/**
 * The keepsake card (Sealed Fire W3, move 10): the shareable character card redrawn as a Wanted
 * poster. Every element the brief lists, top to bottom.
 */
describe('CharacterCard as a Wanted poster', () => {
  it('names the sworn oath in the eyebrow, honestly kept, whether or not it is proven', () => {
    const { getByText, rerender } = render(
      <CharacterCard
        displayName="Erdenebat"
        photoUrl="https://x/me.jpg"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={3}
        oath="Bond"
        oathProven={false}
      />,
    );
    expect(getByText('Wanted')).toBeTruthy();
    expect(getByText(/FOR A BOND, HONESTLY KEPT/)).toBeTruthy();

    rerender(
      <CharacterCard
        displayName="Erdenebat"
        photoUrl="https://x/me.jpg"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={3}
        oath="Bond"
        oathProven
      />,
    );
    // Proven or not, the poster's voice never claims proof — the line is identical either way.
    expect(getByText(/FOR A BOND, HONESTLY KEPT/)).toBeTruthy();
  });

  it('says "a fire" instead of naming an oath when none is sworn', () => {
    const { getByText } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={3}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText(/FOR A FIRE, HONESTLY KEPT/)).toBeTruthy();
  });

  it('names the sharer and their gem-and-score eyebrow', () => {
    const { getByText } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={3}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText('Erdenebat')).toBeTruthy();
    expect(getByText(/RUBY.*1,234/)).toBeTruthy();
  });

  it('counts the streak in words, capitalised at the start of the line', () => {
    const { getByText } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={3}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText('Three dawns and burning. Never let a fire die.')).toBeTruthy();
  });

  it('reads the streak in the singular at exactly one dawn', () => {
    const { getByText } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={1}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText('One dawn and burning. Never let a fire die.')).toBeTruthy();
  });

  it('falls back to the unlit line at a zero streak', () => {
    const { getByText } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={0}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText('A fire lately lit. Never let it die.')).toBeTruthy();
  });

  it('carries the wordmark and the knot, not a wax seal', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <CharacterCard
        displayName="Erdenebat"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={0}
        oath={null}
        oathProven={false}
      />,
    );
    expect(getByText('MingldIngl')).toBeTruthy();
    // Wax means "binds"; the poster's corner mark is the ornament, hidden from assistive tech.
    expect(getByTestId('ulzii-card-knot', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByTestId('glyph-seal', { includeHiddenElements: true })).toBeNull();
  });

  it('renders the sharer\'s own portrait and nothing else as an Image uri', () => {
    const { UNSAFE_getAllByType } = render(
      <CharacterCard
        displayName="Erdenebat"
        photoUrl="https://x/me.jpg"
        gemTier="Ruby"
        totalScore={1234}
        currentStreak={0}
        oath={null}
        oathProven={false}
      />,
    );
    const uris = UNSAFE_getAllByType(Image)
      .map((img) => img.props.source?.uri)
      .filter(Boolean);
    expect(uris).toEqual(['https://x/me.jpg']);
  });
});
