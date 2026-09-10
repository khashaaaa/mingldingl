import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { TorchGlow } from '../vfx/TorchGlow';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, SPACE } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useWaitStage, type WaitKind } from '../../lib/waiting';

const SWING_MS = 2200;
const SWING_DEG = 7;
const CHAIN_HEIGHT = SPACE.lg;
const LAMP_SIZE = ICON_SIZES.huge;

/**
 * A lamp hung from a chain, swinging.
 *
 * `Lantern` is not reused here: that one is the streak's seven flames and means something
 * specific. This is the same visual language at a smaller size and says only "someone is still
 * holding a light for you". MaterialCommunityIcons has no `lantern` glyph, so `lamp` stands in.
 *
 * The pivot is the top of the chain rather than the lamp itself — a lamp that rotates about its
 * own centre wobbles, where one swinging from its chain reads as hanging.
 */
function WaitLantern() {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      swing.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: SWING_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: SWING_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, swing]);

  const rotate = swing.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${SWING_DEG}deg`, `${SWING_DEG}deg`],
  });

  return (
    <Animated.View style={[styles.hang, { transform: [{ rotate }] }]}>
      <View style={styles.chain} />
      <TorchGlow size={LAMP_SIZE} color={COLORS.gold}>
        {/* `Icon` takes only name/size/color/style — it does not forward `testID`, and widening
            that shared primitive's API for one test hook is the larger change. */}
        <View testID="longwait-lamp">
          <Icon name="lamp" size={LAMP_SIZE} color={COLORS.gold} />
        </View>
      </TorchGlow>
    </Animated.View>
  );
}

interface Props {
  kind: WaitKind;
  /**
   * A way out, shown only once the wait reaches its final stage — by then the line has already
   * admitted the wait is long, and offering an escape any earlier invites someone to restart a
   * verification that was about to succeed (and pay another 150₮ for it).
   */
  action?: ReactNode;
}

/**
 * The shape every long wait in the app now takes.
 *
 * Before this, the four longest waits each looked different — `video` showed a spinner and no
 * copy whatsoever, `townsquare-round` a spinner above a line, `quiz` an icon and a card, `otp` a
 * spinner beside a line. Same wait, four layouts, and none of them said anything new as the
 * seconds passed.
 */
export function LongWait({ kind, action }: Props) {
  const stage = useWaitStage(kind);
  const line = i18n.t(stage.key);

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={line}>
      <WaitLantern />
      <Text testID="longwait-line" style={styles.line}>{line}</Text>
      {stage.isFinal && action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: SPACE.lg, paddingVertical: SPACE.xl },
  // The pivot sits at the top of the chain, so the whole assembly swings from where it is hung.
  hang: { alignItems: 'center', transformOrigin: 'top center' },
  chain: { width: 1, height: CHAIN_HEIGHT, backgroundColor: COLORS.brassDark },
  line: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.lg,
    lineHeight: LINE_HEIGHTS.lg,
    color: COLORS.textDim,
    textAlign: 'center',
    paddingHorizontal: SPACE.xl,
  },
});
