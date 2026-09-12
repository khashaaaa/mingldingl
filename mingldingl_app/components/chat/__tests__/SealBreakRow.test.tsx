import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SealBreakRow } from '../SealBreakRow';
import { i18n } from '../../../lib/i18n';
import { FONTS } from '../../../lib/theme';

describe('SealBreakRow', () => {
  it('speaks in italic, per level', () => {
    const { getByText } = render(<SealBreakRow level={3} />);
    const t = getByText('A seal broke here. Their district and third likeness are yours now.');
    expect(StyleSheet.flatten(t.props.style).fontFamily).toBe(FONTS.bodyItalic);
  });

  it('names the membership gate instead of promising fields the engine withheld', () => {
    const { getByText, queryByText } = render(<SealBreakRow level={4} gated />);
    expect(getByText(i18n.t('seals_deep_membership'))).toBeTruthy();
    expect(queryByText(i18n.t('seal_broke_4'))).toBeNull();
  });

  it('still announces the deep seal in full for a member who actually has the fields', () => {
    const { getByText } = render(<SealBreakRow level={4} />);
    expect(getByText(i18n.t('seal_broke_4'))).toBeTruthy();
  });

  it('leaves the earlier seals alone even when gated is somehow set', () => {
    const { getByText } = render(<SealBreakRow level={2} gated />);
    expect(getByText(i18n.t('seal_broke_2'))).toBeTruthy();
  });
});
