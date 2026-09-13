import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { HeaderBar } from '../HeaderBar';
import { Glyph } from '../Glyph';
import { i18n } from '../../../lib/i18n';
import { FONTS, FONT_SIZES } from '../../../lib/theme';

const mockPush = jest.fn();
let mockPathname = '/matches';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: (...args: unknown[]) => mockPush(...args) }),
  usePathname: () => mockPathname,
}));

// `AtlasSigil` reads `WorldProvider` context and mounts `AtlasOverlay` (which itself reads the
// query cache), none of which this file wires up — its own behaviour is covered in
// `atlasMountWarning.test.tsx`. Stood in for here as a plain tagged node so the `chrome` prop's
// gating of it can be asserted without dragging in that whole tree.
jest.mock('../../world/AtlasSigil', () => {
  const { View: RNView } = require('react-native');
  return { AtlasSigil: () => <RNView testID="atlas-sigil" /> };
});

/**
 * Move 12 (Task 7): room names render in `FONTS.wordmark` (the blackletter face) once per
 * screen, Latin titles only — a Cyrillic blackletter has not been commissioned, so a Mongolian
 * title, or any Cyrillic title shown under an `en` locale, stays in `FONTS.display` (Yeseva).
 */
describe('HeaderBar blackletter titles', () => {
  const originalLocale = i18n.locale;
  afterEach(() => {
    i18n.locale = originalLocale;
  });

  it('renders an EN Latin title in the blackletter face, untracked', () => {
    i18n.locale = 'en';
    const { getByText } = render(<HeaderBar title="The Fire" showBack={false} />);
    const style = StyleSheet.flatten(getByText('The Fire').props.style);
    expect(style.fontFamily).toBe(FONTS.wordmark);
    expect(style.fontSize).toBe(FONT_SIZES.roomName);
  });

  it('renders an MN title in Yeseva, not blackletter', () => {
    i18n.locale = 'mn';
    const { getByText } = render(<HeaderBar title="Гал" showBack={false} />);
    const style = StyleSheet.flatten(getByText('Гал').props.style);
    expect(style.fontFamily).toBe(FONTS.display);
  });

  it('keeps a Cyrillic title in Yeseva even when the locale is en', () => {
    i18n.locale = 'en';
    const { getByText } = render(<HeaderBar title="Гал" showBack={false} />);
    const style = StyleSheet.flatten(getByText('Гал').props.style);
    expect(style.fontFamily).toBe(FONTS.display);
  });

  it('keeps a blackletter EN title in blackletter, only smaller, in the compact variant', () => {
    i18n.locale = 'en';
    const { getByText } = render(
      <HeaderBar title="The Fire" showBack={false} right={<Text>x</Text>} />,
    );
    const style = StyleSheet.flatten(getByText('The Fire').props.style);
    expect(style.fontFamily).toBe(FONTS.wordmark);
    expect(style.fontSize).toBe(FONT_SIZES.hero);
    expect(style.fontSize).toBeLessThan(FONT_SIZES.roomName);
  });

  it('does not letter-space the blackletter face', () => {
    i18n.locale = 'en';
    const { getByText } = render(<HeaderBar title="The Fire" showBack={false} />);
    const style = StyleSheet.flatten(getByText('The Fire').props.style);
    expect(style.letterSpacing).toBeLessThan(1);
  });

  it('draws a room glyph beside the title when given one', () => {
    // The hearth tap draws its own glyph (see below), so more than one may be on screen —
    // this only cares that the title's own glyph is among them.
    const { UNSAFE_getAllByType } = render(<HeaderBar title="The Fire" glyph="fire" showBack={false} />);
    expect(UNSAFE_getAllByType(Glyph).some((g) => g.props.name === 'fire')).toBe(true);
  });
});

/**
 * The hearth tap (Task 4): the way home, at the head of the tail row on every screen except the
 * hearth itself. `HEARTH_ENABLED` is a build-time switch (`lib/world/index.ts`); it is on, so
 * these tests exercise the tap directly rather than the flag.
 */
describe('HeaderBar hearth tap', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/matches';
  });

  it('is present on an ordinary screen and pushes to the hearth', () => {
    const { getByTestId } = render(<HeaderBar title="The Bond" showBack={false} />);
    const tap = getByTestId('header-hearth');
    expect(tap.props.accessibilityRole).toBe('button');
    expect(tap.props.accessibilityLabel).toBe(i18n.t('go_home'));
    fireEvent.press(tap);
    expect(mockPush).toHaveBeenCalledWith('/hearth');
  });

  it('draws the hearth glyph', () => {
    const { getByTestId, UNSAFE_getAllByType } = render(<HeaderBar title="The Bond" showBack={false} />);
    getByTestId('header-hearth');
    expect(UNSAFE_getAllByType(Glyph).some((g) => g.props.name === 'hearth')).toBe(true);
  });

  it('is absent on the hearth screen itself', () => {
    mockPathname = '/hearth';
    const { queryByTestId } = render(<HeaderBar title="The Hearth" showBack={false} />);
    expect(queryByTestId('header-hearth')).toBeNull();
  });
});

/**
 * `chrome` (final fix wave, item 1): a screen holding a live call must not offer an exit that
 * leaves the call mounted underneath (`router.push` from the hearth tap or the atlas sigil's
 * overlay does exactly that). Only the round screen sets `chrome={false}` — everywhere else
 * defaults to `true`, so the title, back arrow and `right` slot are unaffected either way.
 */
describe('HeaderBar chrome', () => {
  beforeEach(() => {
    mockPathname = '/townsquare-round/x';
  });

  it('shows both the hearth tap and the atlas sigil by default', () => {
    const { getByTestId } = render(<HeaderBar title="The Bell" showBack={false} />);
    expect(getByTestId('header-hearth')).toBeTruthy();
    expect(getByTestId('atlas-sigil')).toBeTruthy();
  });

  it('hides both the hearth tap and the atlas sigil when chrome is false', () => {
    const { queryByTestId } = render(<HeaderBar title="The Bell" showBack={false} chrome={false} />);
    expect(queryByTestId('header-hearth')).toBeNull();
    expect(queryByTestId('atlas-sigil')).toBeNull();
  });

  it('leaves the title, back arrow and right slot alone when chrome is false', () => {
    const { getByText, getByLabelText } = render(
      <HeaderBar title="The Bell" chrome={false} right={<Text>flag</Text>} />,
    );
    expect(getByText('The Bell')).toBeTruthy();
    expect(getByLabelText(i18n.t('back'))).toBeTruthy();
    expect(getByText('flag')).toBeTruthy();
  });
});
