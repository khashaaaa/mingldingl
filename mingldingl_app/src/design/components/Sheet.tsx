import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/lib/i18n';
import { boxShadow, withAlpha } from '../effects';
import { MOTION } from '../motion';
import { color, dimension, easing } from '../tokens';
import { FillArt } from './Art';
import { DrawerPull } from './Hardware';
import { Overlay } from './Overlay';
import { Txt } from './Txt';

const bez = (e: readonly [number, number, number, number]) => Easing.bezier(e[0], e[1], e[2], e[3]);
export const scrimColor = withAlpha(color.bgScrim, 0.8);

/**
 * A strip that rises from the bottom edge (Sheet rise) and leaves faster than it came: a parchment
 * page with its title (Figma Sheet 14:58), or `menu` — a dark panel of rows under a brass edge with
 * no visible title (Bond — options 31:492).
 */
export function Sheet({
  open,
  title,
  onClose,
  kind = 'parchment',
  children,
}: {
  open: boolean;
  /** Shown on parchment; a menu only names itself to a screen reader. */
  title: string;
  onClose: () => void;
  kind?: 'parchment' | 'menu';
  children: ReactNode;
}) {
  const menu = kind === 'menu';
  const insets = useSafeAreaInsets();
  const m = MOTION.sheetRise;
  return (
    <Overlay open={open} onBack={onClose}>
      <Animated.View
        entering={FadeIn.duration(m.duration)}
        exiting={FadeOut.duration(m.exit)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          testID="scrim"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]}
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(m.duration).easing(bez(easing.forgeOut))}
        exiting={SlideOutDown.duration(m.exit).easing(bez(easing.emberIn))}
        style={[
          styles.sheet,
          menu ? styles.menu : styles.parchment,
          { paddingBottom: (menu ? dimension.space4 : 34) + insets.bottom },
        ]}
        accessibilityViewIsModal
        accessibilityLabel={menu ? title : undefined}
      >
        {menu ? (
          // a long menu (the hours of a day) scrolls inside the strip
          <ScrollView style={styles.menuScroll} bounces={false}>
            {children}
          </ScrollView>
        ) : (
          <>
            <FillArt name="parchment" />
            <DrawerPull />
            <View style={{ height: 4 }} />
            <Txt
              variant="displayM"
              color="textOnParchment"
              engraved
              align="center"
              accessibilityRole="header"
            >
              {title}
            </Txt>
            {children}
          </>
        )}
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    alignItems: 'center',
    boxShadow: boxShadow('shadowDeep'),
    overflow: 'hidden',
  },
  parchment: {
    paddingTop: 14,
    paddingHorizontal: dimension.space5,
    gap: dimension.space4,
    backgroundColor: color.bgParchment,
  },
  menuScroll: { alignSelf: 'stretch' },
  menu: {
    paddingTop: dimension.space4,
    backgroundColor: color.bgPanel,
    borderTopWidth: dimension.strokeHairline,
    borderColor: color.borderBrass,
  },
});
