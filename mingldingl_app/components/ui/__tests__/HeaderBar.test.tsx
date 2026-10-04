import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { HeaderBar } from '../HeaderBar';
import { Glyph } from '../Glyph';
import { i18n } from '../../../lib/i18n';
import { FONTS, FONT_SIZES } from '../../../lib/theme';

const mockPush = jest.fn();
let mockPathname = '/matches';
jest.mock('expo-router', () => require('../../../lib/testing/expoRouterMock').expoRouterMock({
  useRouter: () => ({ back: jest.fn(), push: (...args: unknown[]) => mockPush(...args) }),
  usePathname: () => mockPathname,
}));


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
    expect(style.fontSize).toBe(FONT_SIZES.headerTitle);
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

  it('sets the title at one size whether or not the screen has a right-hand control', () => {
    i18n.locale = 'en';
    const bare = render(<HeaderBar title="The Fire" showBack={false} />).getByText('The Fire');
    const withRight = render(<HeaderBar title="The Fire" showBack={false} right={<Text>x</Text>} />).getByText('The Fire');
    expect(StyleSheet.flatten(withRight.props.style).fontSize).toBe(StyleSheet.flatten(bare.props.style).fontSize);
  });

  it('does not letter-space the blackletter face', () => {
    i18n.locale = 'en';
    const { getByText } = render(<HeaderBar title="The Fire" showBack={false} />);
    const style = StyleSheet.flatten(getByText('The Fire').props.style);
    expect(style.letterSpacing).toBeLessThan(1);
  });

  it('keeps to its four marks — no room glyph, no atlas knot, no knot in the rule', () => {
    mockPathname = '/progression';
    const { UNSAFE_getAllByType, queryByTestId } = render(<HeaderBar title="The Fire" showBack={false} />);
    // The hearth tap is the header's only glyph.
    expect(UNSAFE_getAllByType(Glyph).map((g) => g.props.name)).toEqual(['hearth']);
    expect(queryByTestId('atlas-sigil')).toBeNull();
    expect(queryByTestId('ulzii-divider-knot')).toBeNull();
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
 * leaves the call mounted underneath (`router.push` from the hearth tap does exactly that). Only the round screen sets `chrome={false}` — everywhere else
 * defaults to `true`, so the title, back arrow and `right` slot are unaffected either way.
 */
describe('HeaderBar chrome', () => {
  beforeEach(() => {
    mockPathname = '/townsquare-round/x';
  });

  it('shows the hearth tap by default', () => {
    expect(render(<HeaderBar title="The Bell" showBack={false} />).getByTestId('header-hearth')).toBeTruthy();
  });

  it('hides the hearth tap when chrome is false', () => {
    expect(render(<HeaderBar title="The Bell" showBack={false} chrome={false} />).queryByTestId('header-hearth')).toBeNull();
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

/**
 * One line, one size. A title that cannot fit at full size (a narrow phone, or a title from data)
 * is shrunk by the platform on that line alone — never by a measuring loop, which over-stepped on
 * Android and set five tab titles at five sizes.
 */
describe('HeaderBar title fit', () => {
  it('holds every title to one line and lets only that title shrink, not below the floor', () => {
    const t = render(<HeaderBar title="Trial of Compatibility" showBack={false} />).getByText('Trial of Compatibility');
    expect(t.props.numberOfLines).toBe(1);
    expect(t.props.adjustsFontSizeToFit).toBe(true);
    expect(t.props.minimumFontScale).toBeGreaterThanOrEqual(0.5);
  });

  it('sets a Cyrillic title at the one Yeseva size on every screen', () => {
    const original = i18n.locale;
    i18n.locale = 'mn';
    const short = render(<HeaderBar title="Гал" showBack={false} />).getByText('Гал');
    const long = render(<HeaderBar title="Даалгаврын самбар" showBack={false} right={<Text>x</Text>} />).getByText('Даалгаврын самбар');
    expect(StyleSheet.flatten(short.props.style).fontSize).toBe(FONT_SIZES.title);
    expect(StyleSheet.flatten(long.props.style).fontSize).toBe(FONT_SIZES.title);
    i18n.locale = original;
  });
});
