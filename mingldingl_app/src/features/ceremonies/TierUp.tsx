import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { asTier, GEM, TIERS, type Tier } from '@/design/components/GemBadge';
import { Overlay } from '@/design/components/Overlay';
import { Txt } from '@/design/components/Txt';
import { withAlpha } from '@/design/effects';
import { useReduceMotion } from '@/design/motion';
import { color, dimension } from '@/design/tokens';
import { WorldFloor } from '@/design/world/WorldFloor';
import { seenTierUp, useGetMe } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { type StringKey, t, tLine } from '@/lib/i18n';
import { TierUpBehind, TierUpOver } from './TierUpLight';
import { AT, easeOutCubic, newGem, oldGem, seg } from './tierUpTimeline';

const GLOW: Record<Tier, string> = {
  Garnet: color.gemGarnetGlow,
  Opal: color.gemOpalGlow,
  Amethyst: color.gemAmethystGlow,
  Sapphire: color.gemSapphireGlow,
  Ruby: color.gemRubyGlow,
  Emerald: color.gemEmeraldGlow,
};

const CORE: Record<Tier, string> = {
  Garnet: color.gemGarnetCore,
  Opal: color.gemOpalCore,
  Amethyst: color.gemAmethystCore,
  Sapphire: color.gemSapphireCore,
  Ruby: color.gemRubyCore,
  Emerald: color.gemEmeraldCore,
};

const OLD_GEM = 140;
const NEW_GEM = 180;
/** Under Reduce Motion the ceremony opens on its last frame. */
const STILL = AT.ready + 1000;

/**
 * The tier-up ceremony (Figma 36:88 crack · 36:147 beam · 36:201 the new gem), one clock on the UI
 * thread (`tierUpTimeline`): the old gem trembles and cracks with the new light leaking through,
 * shatters into a beam of that light, and the new gem is forged in it and rises amid its rays.
 * Shown once, over whatever screen is open, when the engine marks a tier rise (`tierUpPending`);
 * Continue tells the engine it was seen, on every device at once.
 */
export function TierUp() {
  const profile = useGetMe().data?.profile;
  const pending = profile?.tierUpPending ? asTier(profile.tierUpPending) : null;
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);

  const clock = useSharedValue(0);
  // Timed from its own start, not the callback's first frame: a re-render re-registers the
  // callback, and `timeSinceFirstFrame` would start the ceremony over.
  const start = useSharedValue(-1);
  const frame = useFrameCallback((f) => {
    if (start.value < 0) start.value = f.timestamp;
    clock.value = f.timestamp - start.value;
  }, false);
  // The handle is a new object each render; the ceremony must start once per tier, not per render.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const frame = frameRef.current;
    if (!pending) return;
    if (reduce) {
      clock.value = STILL;
      setReady(true);
      feedback('tierUp');
      return;
    }
    setReady(false);
    clock.value = 0;
    start.value = -1;
    frame.setActive(true);
    const timers = [
      setTimeout(() => feedback('sealStamp'), AT.shatter),
      setTimeout(() => feedback('tierUp'), AT.forge),
      setTimeout(() => setReady(true), AT.ready),
    ];
    return () => {
      timers.forEach(clearTimeout);
      frame.setActive(false);
    };
  }, [pending, reduce, clock, start]);

  const oldStyle = useAnimatedStyle(() => {
    const g = oldGem(clock.value);
    return { opacity: g.opacity, transform: [{ translateX: g.x }, { translateY: g.y }, { scale: g.scale }] };
  });
  const oldName = useAnimatedStyle(() => ({
    opacity: seg(clock.value, AT.dark + 150, AT.crack) * (1 - seg(clock.value, AT.crack + 300, AT.shatter)),
  }));
  const newStyle = useAnimatedStyle(() => {
    const g = newGem(clock.value);
    return { opacity: g.opacity, transform: [{ translateY: g.y }, { scale: g.scale }] };
  });
  // The name ink-bleeds in: it swells out of the dark and settles.
  const nameStyle = useAnimatedStyle(() => {
    const p = easeOutCubic(seg(clock.value, AT.name, AT.name + 360));
    return { opacity: p, transform: [{ scale: 1.12 - 0.12 * p }] };
  });
  const lineStyle = useAnimatedStyle(() => {
    const p = easeOutCubic(seg(clock.value, AT.line, AT.line + 400));
    return { opacity: p, transform: [{ translateY: 8 * (1 - p) }] };
  });
  const footStyle = useAnimatedStyle(() => ({ opacity: seg(clock.value, AT.ready - 200, AT.ready + 200) }));

  if (!pending) return null;
  const old = TIERS[Math.max(0, TIERS.indexOf(pending) - 1)] ?? 'Garnet';
  const done = () => {
    seenTierUp().catch(() => {});
  };
  // Figma holds the gem a little above the middle, its name and line beneath it.
  const cx = width / 2;
  const cy = height * 0.36;
  const light = {
    clock,
    cx,
    cy,
    width,
    height,
    glow: GLOW[pending],
    oldCore: CORE[old],
    oldGlow: GLOW[old],
  };

  return (
    <Overlay open onBack={done}>
      <View style={styles.screen}>
        {/* The ceremony covers the screen it rose over, but not the night (every Figma phase keeps the floor). */}
        <View style={StyleSheet.absoluteFill}>
          <WorldFloor fire="Lit" />
          <View style={styles.veil} />
        </View>
        <TierUpBehind {...light} />
        <Animated.View style={[styles.gem, gemBox(cx, cy, OLD_GEM), oldStyle]}>
          <Art name={GEM[old]} style={styles.fill} fit="contain" />
        </Animated.View>
        <Animated.View style={[styles.gem, gemBox(cx, cy, NEW_GEM), newStyle]}>
          <Art name={GEM[pending]} style={styles.fill} fit="contain" />
        </Animated.View>
        <Animated.View style={[styles.words, { top: cy + OLD_GEM / 2 + dimension.space4 }, oldName]}>
          <Txt variant="displayL" color="textSecondary" engraved align="center">
            {t(`tier.${old}`)}
          </Txt>
        </Animated.View>
        <View style={[styles.words, { top: cy + NEW_GEM / 2 + dimension.space6 }]}>
          <Animated.View style={nameStyle}>
            <Txt variant="displayXL" color="textAccent" engraved align="center" accessibilityRole="header">
              {tLine('ceremony.tierTitle', { tier: `tier.${pending}` })}
            </Txt>
          </Animated.View>
          <Animated.View style={lineStyle}>
            <Txt variant="voiceL" color="textSecondary" align="center">
              {t(`tierCeremony.${pending}` as StringKey)}
            </Txt>
          </Animated.View>
        </View>
        <TierUpOver {...light} />
        <Animated.View
          style={[styles.footer, { paddingBottom: insets.bottom + dimension.space5 }, footStyle]}
          pointerEvents={ready ? 'auto' : 'none'}
        >
          <Button label={t('ceremony.continue')} onPress={done} block />
        </Animated.View>
      </View>
    </Overlay>
  );
}

const gemBox = (cx: number, cy: number, size: number) => ({
  left: cx - size / 2,
  top: cy - size / 2,
  width: size,
  height: size,
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgSunken },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: withAlpha(color.bgSunken, 0.6),
  },
  gem: { position: 'absolute' },
  fill: { width: '100%', height: '100%' },
  words: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: dimension.space4,
    paddingHorizontal: dimension.sizeGutter,
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: dimension.sizeGutter },
});
