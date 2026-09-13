import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../lib/i18n';
import { FONTS, FONT_SIZES, ICON_SIZES, SPACE, STATUS_DEEP, TEMPERATURE } from '../lib/theme';
import { Glyph } from './ui/Glyph';
import { FrostEdge, FROST_RIM_REACH } from './vfx/FrostEdge';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Glyph name="ice" size={ICON_SIZES.sm} color={TEMPERATURE.rime} />
        <Text style={styles.text}>{i18n.t('offline_banner')}</Text>
      </View>
      {/* The road itself gone quiet, not just a warning colour — reuses the one frost drawing
          rather than a second way of saying "silence" on this strip. A rim reach, not the
          screen-edge default: the banner itself is shorter than the default 96 deep. */}
      <View style={styles.frostWrap} pointerEvents="none">
        <FrostEdge edge="bottom" length={FROST_RIM_REACH} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: STATUS_DEEP.warning,
    paddingBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  frostWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  text: {
    flexShrink: 1,
    color: TEMPERATURE.rime,
    fontFamily: FONTS.bodyBold,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
});
