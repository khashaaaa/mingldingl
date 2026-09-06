import { useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { ORNAMENTS } from '../../lib/ornaments';
import { WORLD_ENABLED } from '../../lib/world';
import { i18n } from '../../lib/i18n';
import { ICON_SIZES, SPACE } from '../../lib/theme';
import { AtlasOverlay } from './AtlasOverlay';
import { useWorld } from './WorldProvider';

/**
 * The only way into the atlas. Drawn by `HeaderBar` itself rather than passed through its `right`
 * slot, which several screens already occupy — so every screen on the shared chrome gets the map
 * for free, and the screens deliberately off it (the video call, full-screen modals) correctly do
 * not.
 */
export function AtlasSigil() {
  const world = useWorld();
  const [open, setOpen] = useState(false);

  if (!WORLD_ENABLED || !world?.room) return null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={SPACE.sm}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('hold_open')}
        testID="atlas-sigil"
      >
        <Image source={ORNAMENTS.knotGold} style={styles.sigil} resizeMode="contain" />
      </Pressable>
      <AtlasOverlay visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  sigil: { width: ICON_SIZES.lg, height: ICON_SIZES.lg, opacity: 0.85 },
});
