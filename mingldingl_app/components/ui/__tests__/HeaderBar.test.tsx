import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { HeaderBar } from '../HeaderBar';
import { Glyph } from '../Glyph';
import { i18n } from '../../../lib/i18n';
import { FONTS, FONT_SIZES } from '../../../lib/theme';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

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
    const { UNSAFE_getByType } = render(<HeaderBar title="The Fire" glyph="fire" showBack={false} />);
    expect(UNSAFE_getByType(Glyph).props.name).toBe('fire');
  });
});
