import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { ChestBurst } from '../vfx/ChestBurst';
import { TorchGlow } from '../vfx/TorchGlow';
import { GemTierBadge } from '../progression/GemTierBadge';
import { i18n } from '../../lib/i18n';
import { colorForTier, tierLabel } from '../../lib/tiers';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE, overlay } from '../../lib/theme';

interface Props {
  visible: boolean;
  /** The tier just reached. */
  tier: string;
  /** The tier being left behind — the same as `tier` on the first rung, where nothing is shed. */
  previousTier: string;
  onDismiss: () => void;
}

const BADGE_SIZE = 96;
const BURST_SIZE = 240;
const SHAKE_STEP_MS = 60;
const SHAKE_STEPS = 4;
const SHED_MS = 260;
const RISE_MS = 320;

/**
 * The gem reforged. A tier-up used to be a toast at the bottom of whatever screen you were on —
 * the one moment the whole economy is built towards, announced like a saved draft. This is the
 * ceremony instead: the old stone shakes, breaks, and the new one is struck from it.
 *
 * Three beats, each handed to the next by its completion callback rather than by timers, so a
 * dismissal mid-sequence stops the chain cleanly: the old badge shakes; it shrinks and fades as
 * the burst fires; the new badge springs in under its torch and the title rises beneath it.
 * With motion off the whole thing is drawn at its end state on the first frame — the ceremony is
 * the *reveal*, not the movement, and someone who asked for less motion still gets the reveal.
 */
export function TierUpCeremony({ visible, tier, previousTier, onDismiss }: Props) {
  const level = useVfxLevel();
  const color = colorForTier(tier);

  const shake = useRef(new Animated.Value(0)).current;
  const oldScale = useRef(new Animated.Value(1)).current;
  const oldOpacity = useRef(new Animated.Value(1)).current;
  const newScale = useRef(new Animated.Value(0.4)).current;
  const newOpacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    function reset() {
      anim.current?.stop();
      anim.current = null;
      shake.setValue(0);
      oldScale.setValue(1); oldOpacity.setValue(1);
      newScale.setValue(0.4); newOpacity.setValue(0);
      rise.setValue(0);
      setRevealed(false);
    }
    if (!visible) { reset(); return; }

    if (!motionAllowed(level)) {
      oldScale.setValue(0.4); oldOpacity.setValue(0);
      newScale.setValue(1); newOpacity.setValue(1);
      rise.setValue(1);
      setRevealed(true);
      return reset;
    }

    // Beat one: the old stone shakes. Beat two, chained off its completion: it sheds — shrinks
    // and fades — while the burst fires. Beat three: the new stone springs in and the words rise.
    const shakeAnim = Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: SHAKE_STEP_MS, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: SHAKE_STEP_MS, useNativeDriver: true }),
        ]),
        { iterations: SHAKE_STEPS },
      ),
      Animated.timing(shake, { toValue: 0, duration: SHAKE_STEP_MS / 2, useNativeDriver: true }),
    ]);
    const shedAnim = Animated.parallel([
      Animated.timing(oldScale, { toValue: 0.4, duration: SHED_MS, useNativeDriver: true }),
      Animated.timing(oldOpacity, { toValue: 0, duration: SHED_MS, useNativeDriver: true }),
    ]);
    const forgeAnim = Animated.sequence([
      Animated.parallel([
        Animated.spring(newScale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 180 }),
        Animated.timing(newOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.timing(rise, { toValue: 1, duration: RISE_MS, useNativeDriver: true }),
    ]);

    anim.current = shakeAnim;
    shakeAnim.start(({ finished }) => {
      if (!finished) return;
      setBurst((b) => b + 1);
      anim.current = shedAnim;
      shedAnim.start(({ finished: shed }) => {
        if (!shed) return;
        anim.current = forgeAnim;
        forgeAnim.start(({ finished: forged }) => { if (forged) setRevealed(true); });
      });
    });
    return reset;
  }, [visible, level]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.stage}>
          <View style={styles.burstWrap} pointerEvents="none">
            <ChestBurst size={BURST_SIZE} trigger={burst} />
          </View>
          <Animated.View
            testID="tier-up-old-badge"
            style={[
              styles.badgeSlot,
              {
                opacity: oldOpacity,
                transform: [
                  { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
                  { scale: oldScale },
                ],
              },
            ]}
          >
            <GemTierBadge tier={previousTier} size={BADGE_SIZE} />
          </Animated.View>
          <Animated.View
            testID="tier-up-new-badge"
            style={[styles.badgeSlot, { opacity: newOpacity, transform: [{ scale: newScale }] }]}
          >
            <TorchGlow size={BADGE_SIZE * 1.6} color={color}>
              <GemTierBadge tier={tier} size={BADGE_SIZE} glow />
            </TorchGlow>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.words,
            {
              opacity: rise,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Text style={[styles.title, { color }]}>{i18n.t('tier_up_title', { tier: tierLabel(tier) })}</Text>
        </Animated.View>

        {revealed && (
          <View style={styles.footer}>
            <GameButton variant="primary" style={styles.closeBtn} onPress={onDismiss}>
              {i18n.t('continue_btn')}
            </GameButton>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: overlay(0.92),
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xxl,
    paddingHorizontal: SPACE.xl,
  },
  stage: { width: BURST_SIZE, height: BURST_SIZE, alignItems: 'center', justifyContent: 'center' },
  burstWrap: { ...StyleSheet.absoluteFillObject },
  badgeSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  words: { alignItems: 'center', gap: SPACE.sm },
  title: {
    fontFamily: FONTS.displayBlack,
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.lg,
    alignItems: 'center',
    minWidth: 260,
  },
  closeBtn: { alignSelf: 'stretch' },
});
