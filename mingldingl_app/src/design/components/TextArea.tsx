import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { boxShadow } from '../effects';
import { color, dimension, type } from '../tokens';
import { type FieldProps, fieldBorder } from './Input';
import { useReveal } from './reveal';
import { Txt } from './Txt';

/** Several lines of the person's own words, counted against the limit. */
export function TextArea({ label, value, onChangeText, error, disabled, maxLength, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const reveal = useReveal();
  return (
    <View ref={reveal.ref} onLayout={reveal.onLayout} style={[styles.wrap, disabled && { opacity: 0.4 }]}>
      <Txt variant="labelS" color="textSecondary">
        {label}
      </Txt>
      <View style={[styles.field, { borderColor: fieldBorder(focused, error) }]}>
        <TextInput
          {...rest}
          multiline
          accessibilityLabel={label}
          editable={!disabled}
          value={value}
          maxLength={maxLength}
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
          textAlignVertical="top"
          style={[type.bodyM, styles.text]}
        />
      </View>
      {maxLength ? (
        <Txt variant="labelS" color="textMuted">
          {`${value.length} / ${maxLength}`}
        </Txt>
      ) : null}
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
    minHeight: 78,
    paddingVertical: 14,
    paddingHorizontal: dimension.space4,
    backgroundColor: color.bgSunken,
    borderWidth: dimension.strokeHairline,
    borderRadius: dimension.radiusSm,
    boxShadow: boxShadow('insetCarved'),
  },
  text: { color: color.textPrimary, padding: 0, minHeight: 48 },
});
