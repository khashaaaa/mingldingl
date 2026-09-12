import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Waiting } from './Waiting';
import { TorchGlow } from '../vfx/TorchGlow';
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
      <WaitCandle />
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
