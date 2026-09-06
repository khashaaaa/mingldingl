import { forwardRef } from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, LINE, RADIUS, SPACE } from '../../lib/theme';

interface Props extends TextInputProps {
  // A single-line field is 52px tall. multiline fields grow between the two bounds.
  minHeight?: number;
  maxHeight?: number;
}

// The one text field. Panel-coloured, bronze-bordered, set in the body face —
// every input in the app looks like this, so the styling lives here once.
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { style, multiline, minHeight, maxHeight, placeholderTextColor = COLORS.textDim, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={placeholderTextColor}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        styles.field,
        multiline ? styles.multiline : styles.single,
        minHeight !== undefined && { minHeight },
        maxHeight !== undefined && { maxHeight },
        style,
      ]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: LINE.edge,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.body,
  },
  single: { height: 52 },
  multiline: { minHeight: 104, paddingVertical: SPACE.md },
});
