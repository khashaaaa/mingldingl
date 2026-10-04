import { Image, StyleSheet, Text, View } from 'react-native';
import { type Href } from 'expo-router';
import { Tap } from '../ui/Tap';
import { Icon } from '../ui/Icon';
import { SATCHEL_IMAGES, type SatchelObject } from './satchelImages';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, SPACE } from '../../lib/theme';
import { useGoTo } from '../../hooks/useGoTo';

interface Props {
  object: SatchelObject;
  name: string;
  line: string;
  to: Href;
  testID?: string;
}

/**
 * One held object, drawn the same way for all nine: the thing itself, painted (the one screen
 * where the app shows objects rather than ink glyphs — `scripts/gen-satchel.js`), its name, and
 * the one sentence that states what it currently is. Nothing here computes a fact — the screen hands down
 * a finished line, this only lays it out and, on a tap, goes to the room where the object is
 * actually used (`Destinations.tsx`'s "a second way to each room" rule cuts the other way here:
 * this *is* the second way, into rooms the tab bar already reaches).
 *
 * The painting carries no label of its own (the row's label already says what it is), so the
 * whole fact — name and state — lives on the `Tap`, the same grouping rule every labelled row in
 * this app follows.
 */
export function SatchelRow({ object, name, line, to, testID }: Props) {
  const go = useGoTo();

  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${line}`}
      onPress={() => go(to)}
    >
      <View style={styles.row}>
        <Image
          source={SATCHEL_IMAGES[object]}
          style={styles.art}
          testID={`satchel-art-${object}`}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.text}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
        {/* A decorative glyph, not itself an accessible node — the row's own label already says
            everything a chevron would otherwise stand in for. */}
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
  // Glyph-sized: the painting keeps one silhouette and one lit face so it reads at this size.
  art: { width: ICON_SIZES.huge, height: ICON_SIZES.huge },
  text: { flex: 1 },
  name: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.primary },
  line: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: INK.dim, marginTop: SPACE.hair },
});
