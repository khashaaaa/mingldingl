import { useEffect, type ReactNode } from 'react';
import { useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { StyleSheet, Text, View } from 'react-native';
import { Waiting } from './Waiting';
import { TorchGlow } from '../vfx/TorchGlow';
import { SCENES, useRoomScene } from '../vfx/scenes';
import { useVfxLevel } from '../../lib/vfx';
import { i18n } from '../../lib/i18n';
import { LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';
import { useWaitStage, type WaitKind } from '../../lib/waiting';

/** The long wait is the same candle a button burns, at the size of a thing you sit with. */
const CANDLE_SIZE = ICON_SIZES.hero;

/**
 * A candle, kept alight for as long as the wait lasts.
 *
 * This was a lamp swinging from a chain, which said "hanging" more than it said "waiting", and
 * said it in a different drawing from the one every button was already using. One candle across
 * the app: the same flame, bigger, with the torch glow left under it because a light with no
 * warmth around it reads as an icon rather than as a flame.
 */
function WaitCandle() {
  return (
    <TorchGlow size={CANDLE_SIZE} color={ACCENT.base}>
      {/* The block around it is already the progressbar, and it announces the line being read
          out as well — so the candle's own `busy` role is silenced here rather than announced
          twice, one of them unlabelled. */}
      <View importantForAccessibility="no-hide-descendants" aria-hidden>
        <Waiting size={CANDLE_SIZE} color={ACCENT.base} />
      </View>
    </TorchGlow>
  );
}

/** The scene's canvas height: the same hearth a list is pulled down into, a little taller. */
const SCENE_H = 120;

/**
 * The room's scene (`ROOM_SCENES`), playing itself: gathered over the first moments, then at work
 * for as long as the wait lasts. Nothing settles it — the wait ending unmounts it.
 */
function SceneWait() {
  const Scene = SCENES[useRoomScene()];
  const gather = useSharedValue(0);
  const active = useSharedValue(0);
  const settle = useSharedValue(0);
  useEffect(() => {
    gather.value = withTiming(1, { duration: 900 });
    active.value = withDelay(800, withSequence(withTiming(1.3, { duration: 200 }), withSpring(1, { damping: 9, stiffness: 140 })));
  }, [gather, active]);
  return (
    <View testID="longwait-scene" importantForAccessibility="no-hide-descendants" aria-hidden>
      <Scene height={SCENE_H} gather={gather} active={active} settle={settle} />
    </View>
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
  // The scene needs Skia and motion; anywhere else the candle keeps the wait.
  const full = useVfxLevel() === 'full';

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={line}>
      {full ? <SceneWait /> : <WaitCandle />}
      <Text testID="longwait-line" style={styles.line}>{line}</Text>
      {stage.isFinal && action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: SPACE.lg, paddingVertical: SPACE.xl },
  line: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.lg,
    lineHeight: LEADING.lg,
    color: INK.dim,
    textAlign: 'center',
    paddingHorizontal: SPACE.xl,
  },
});
