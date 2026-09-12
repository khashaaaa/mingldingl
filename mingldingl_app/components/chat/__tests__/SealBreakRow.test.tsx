import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SealBreakRow } from '../SealBreakRow';
import { FONTS } from '../../../lib/theme';

describe('SealBreakRow', () => {
  it('speaks in italic, per level', () => {
    const { getByText } = render(<SealBreakRow level={3} />);
    const t = getByText('A seal broke here. Their district and third likeness are yours now.');
    expect(StyleSheet.flatten(t.props.style).fontFamily).toBe(FONTS.bodyItalic);
  });
});
