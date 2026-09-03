import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CardEyebrow } from '../CardEyebrow';
import { COLORS, FONTS, FONT_SIZES } from '../../../lib/theme';

describe('CardEyebrow', () => {
  it('uppercases its label so call sites do not have to', () => {
    const { getByText } = render(<CardEyebrow>Thread log</CardEyebrow>);
    expect(getByText('THREAD LOG')).toBeTruthy();
  });

  it('sets small labels in the utility face, not the display serif', () => {
    const { getByText } = render(<CardEyebrow>trophies</CardEyebrow>);
    const style = StyleSheet.flatten(getByText('TROPHIES').props.style);
    expect(style.fontFamily).toBe(FONTS.utility);
    expect(style.fontSize).toBe(FONT_SIZES.xs);
  });

  it('defaults to dim text and accepts an accent colour', () => {
    const { getByText, rerender } = render(<CardEyebrow>quests</CardEyebrow>);
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(COLORS.textDim);

    rerender(<CardEyebrow color={COLORS.gold}>quests</CardEyebrow>);
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(COLORS.gold);
  });

  it('uppercases Mongolian Cyrillic labels', () => {
    const { getByText } = render(<CardEyebrow>Өдрийн даалгавар</CardEyebrow>);
    expect(getByText('ӨДРИЙН ДААЛГАВАР')).toBeTruthy();
  });
});
