import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { color, dimension, type } from '../tokens';
import { FillArt, Glyph } from './Art';

/**
 * The letter field and the brass send boss (Figma 31:97, Send Button 113:9536). Uncontrolled: the
 * text lives in the native field so fast typing never loses a key; `onSend` gets it and the field
 * clears only when the letter is accepted.
 */
export function Composer({
  placeholder,
  sendLabel,
  disabled,
  maxLength,
  onSend,
}: {
  placeholder: string;
  sendLabel: string;
  disabled?: boolean;
  maxLength: number;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [field, setField] = useState<TextInput | null>(null);
  const [busy, setBusy] = useState(false);
  const empty = text.trim().length === 0;
  const send = async () => {
    if (empty || busy || disabled) return;
    setBusy(true);
    const ok = await onSend(text.trim());
    setBusy(false);
    if (ok) {
      field?.clear();
      setText('');
    }
  };
  return (
    <View style={styles.row}>
      <TextInput
        ref={setField}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        onChangeText={setText}
        editable={!disabled}
        multiline
        maxLength={maxLength}
        // the placeholder speaks in the italic voice; typed words look like the letter they become
        style={[styles.field, text ? type.bodyM : type.voiceM, disabled && styles.off]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
        accessibilityState={{ disabled: disabled || empty || busy }}
        disabled={disabled || empty || busy}
        onPressIn={() => feedback('press')}
        onPress={send}
        style={[styles.boss, (disabled || empty) && styles.dim]}
      >
        <FillArt name="brass_plate" />
        <View style={styles.arrow}>
          <Glyph name="back" size={22} tint="textOnParchment" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: dimension.space3 },
  field: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    color: color.textPrimary,
    paddingHorizontal: dimension.space3,
    paddingVertical: dimension.space3,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderStrong,
    backgroundColor: color.bgSunken,
  },
  off: { opacity: 0.5 },
  boss: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
  },
  dim: { opacity: 0.55 },
  arrow: { transform: [{ rotate: '180deg' }] },
});
