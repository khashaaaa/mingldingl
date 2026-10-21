import { type Ref, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { color, dimension, type } from '../tokens';
import { useReveal } from './reveal';
import { Txt } from './Txt';

export type FieldProps = Omit<TextInputProps, 'style' | 'onChangeText' | 'value'> & {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  error?: string | null;
  disabled?: boolean;
};

type InputProps = FieldProps & {
  /** Fixed text before the value that is not part of it, e.g. a country code. */
  prefix?: string;
  /** For a form's Next key to move focus here. */
  ref?: Ref<TextInput>;
};

/** The field's underline: ember on error, gold while focused, otherwise a strong ink line. */
export function fieldBorder(focused: boolean, error?: string | null) {
  return error ? color.statusDanger : focused ? color.borderGold : color.borderStrong;
}

/**
 * A field on the panel's tone (a sunken black box read as a hole in the night): hairline frame,
 * and an underline that turns gold on focus and ember on error.
 */
export function Input({ label, value, onChangeText, error, disabled, prefix, ref, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const reveal = useReveal();
  return (
    <View ref={reveal.ref} onLayout={reveal.onLayout} style={[styles.wrap, disabled && { opacity: 0.4 }]}>
      <Txt variant="labelS" color="textSecondary">
        {label}
      </Txt>
      <View style={[styles.field, { borderBottomColor: fieldBorder(focused, error) }]}>
        {prefix ? (
          <Txt variant="bodyM" color="textSecondary">
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={label}
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            reveal.focus();
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            reveal.blur();
            rest.onBlur?.(e);
          }}
          placeholderTextColor={color.textMuted}
          selectionColor={color.accentGold}
          style={[type.bodyM, styles.text]}
        />
      </View>
      {error ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: dimension.space2, alignSelf: 'stretch' },
  field: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space2,
    paddingHorizontal: dimension.space4,
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderBottomWidth: dimension.strokeRule,
    borderRadius: dimension.radiusSm,
  },
  text: { flex: 1, color: color.textPrimary, paddingVertical: 0 },
});
