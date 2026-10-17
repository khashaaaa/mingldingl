import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import type { GlyphName } from '../glyphs';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

/**
 * Figma's Setting Row (War Room): an ink glyph, a title with a line under it, and at the end a
 * value with a chevron (it opens something) or a control such as a Toggle.
 */
export function SettingRow({
  glyph,
  title,
  subtitle,
  value,
  onPress,
  control,
}: {
  glyph: GlyphName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  control?: ReactNode;
}) {
  const body = (
    <>
      <Glyph name={glyph} size={20} tint="textSecondary" />
      <View style={styles.text}>
        <Txt variant="bodyM">{title}</Txt>
        {subtitle ? (
          <Txt variant="bodyS" color="textMuted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="bodyS" color="textAccent" numberOfLines={1} style={styles.value}>
          {value}
        </Txt>
      ) : null}
      {control ?? (onPress ? <Glyph name="chevron" size={16} tint="textMuted" /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.row}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.row}>{body}</View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: dimension.sizeGutter,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  text: { flex: 1, gap: 2 },
  value: { maxWidth: '40%' },
});
