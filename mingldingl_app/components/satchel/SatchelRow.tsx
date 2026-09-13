import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Tap } from '../ui/Tap';
import { Icon } from '../ui/Icon';
import { MaterialMark, type Material } from '../ui/MaterialMark';
import type { GlyphName } from '../ui/Glyph';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, SPACE } from '../../lib/theme';

interface Props {
  material: Material;
  glyph: GlyphName;
  name: string;
  line: string;
  to: Href;
  testID?: string;
}

/**
 * One held object, drawn the same way for all nine: its material and glyph, its name, and the one
 * sentence that states what it currently is. Nothing here computes a fact — the screen hands down
 * a finished line, this only lays it out and, on a tap, goes to the room where the object is
 * actually used (`Destinations.tsx`'s "a second way to each room" rule cuts the other way here:
 * this *is* the second way, into rooms the tab bar already reaches).
 *
 * `MaterialMark` carries no label of its own (the row's label already says what it is), so the
 * whole fact — name and state — lives on the `Tap`, the same grouping rule every labelled row in
 * this app follows.
 */
export function SatchelRow({ material, glyph, name, line, to, testID }: Props) {
  const router = useRouter();

  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${line}`}
      onPress={() => router.push(to)}
    >
      <View style={styles.row}>
        <MaterialMark material={material} glyph={glyph} />
        <View style={styles.text}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
        {/* Plain MaterialCommunityIcons text, not itself an accessible node — the row's own
            label already says everything a chevron would otherwise stand in for. */}
        <Icon name="chevron-right" size={ICON_SIZES.lg} color={INK.dim} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: LINE.hairline,
  },
  text: { flex: 1 },
  name: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.primary },
  line: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim, marginTop: SPACE.hair },
});
