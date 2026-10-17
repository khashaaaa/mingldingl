import { Pressable, StyleSheet } from 'react-native';
import { feedback } from '@/lib/feedback';
import type { GlyphName } from '../glyphs';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

/** A door off the Hearth (Figma "Destination Tile"): a gold glyph over its name. */
export function DestinationTile({
  glyph,
  label,
  onPress,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.tile}
    >
      <Glyph name={glyph} size={32} tint="accentGoldBright" />
      <Txt variant="labelS" align="center" numberOfLines={2}>
        {label.toUpperCase()}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: dimension.space2,
    backgroundColor: color.bgRaised,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderRadius: dimension.radiusSm,
  },
});
