import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Tap } from '../ui/Tap';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, SPACE } from '../../lib/theme';

/**
 * The five places the hold is made of, plus what you carry to them.
 *
 * A map, never a hallway: these rows are a *second* way to each room, not the only one — the tab
 * bar still stands (`HEARTH_ENABLED`'s own note), and every route here is reachable without ever
 * passing through the hearth. That is the law the screen prints under them.
 *
 * The Satchel is the one row drawn in ink rather than gold, and the one without a glyph: it is not
 * a room on the atlas, it is the bag — what today's rules gave you, on the way to somewhere else.
 */

interface Destination {
  /** Also the row's `testID` (`destination-<id>`). */
  id: string;
  labelKey: string;
  glyph: GlyphName;
  route: Href;
}

const DESTINATIONS: readonly Destination[] = [
  { id: 'fire', labelKey: 'dest_fire', glyph: 'fire', route: '/(tabs)/discover' },
  { id: 'letters', labelKey: 'dest_letters', glyph: 'letters', route: '/(tabs)/matches' },
  { id: 'square', labelKey: 'dest_square', glyph: 'lantern', route: '/(tabs)/townsquare' },
  { id: 'forge', labelKey: 'dest_forge', glyph: 'forge', route: '/(tabs)/activity' },
  { id: 'mirror', labelKey: 'dest_mirror', glyph: 'gem', route: '/(tabs)/profile' },
];

export function Destinations() {
  const router = useRouter();

  return (
    <View>
      {DESTINATIONS.map(({ id, labelKey, glyph, route }) => {
        const name = i18n.t(labelKey);
        return (
          <Tap
            key={id}
            testID={`destination-${id}`}
            accessibilityRole="button"
            // The name is the whole fact. The glyph beside it is unlabelled on purpose — labelled,
            // it would read the room's name twice.
            accessibilityLabel={name}
            onPress={() => router.push(route)}
          >
            <View style={styles.row}>
              <Glyph name={glyph} size={ICON_SIZES.lg} color={ACCENT.base} />
              <Text style={styles.name}>{name}</Text>
            </View>
          </Tap>
        );
      })}
      <Tap
        testID="destination-satchel"
        accessibilityRole="button"
        accessibilityLabel={i18n.t('dest_satchel')}
        onPress={() => router.push('/satchel')}
      >
        <View style={[styles.row, styles.satchelRow]}>
          <Text style={styles.satchel}>{i18n.t('dest_satchel')}</Text>
        </View>
      </Tap>
    </View>
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
  name: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.lg, color: INK.primary },
  // No glyph, but its name still starts in the rooms' name column rather than under their glyphs.
  satchelRow: { paddingLeft: ICON_SIZES.lg + SPACE.md },
  satchel: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
});
