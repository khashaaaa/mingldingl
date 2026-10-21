import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import type { GlyphName } from '../glyphs';
import { curve, useReduceMotion } from '../motion';
import { dimension } from '../tokens';
import { Art, FillArt, Glyph } from './Art';
import { Txt } from './Txt';

type Action = { glyph: GlyphName; label: string; onPress: () => void };

/**
 * A room's name over a dry-brush rule; `onBack` is a ← back, `onHome` (the tab rooms) the hearth
 * glyph that goes up to the Hearth; blackletter in English, Yeseva One in Mongolian (via Txt).
 * `sign` hangs the name on a brass plank chained from the top of the screen (Figma "Hanging
 * Sign", the Guild House).
 */
export function RoomHeader({
  title,
  onBack,
  onHome,
  action,
  sign,
}: {
  title: string;
  onBack?: () => void;
  onHome?: () => void;
  action?: Action;
  sign?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + dimension.space3 }]}>
      {sign && <HangingSign title={title} top={insets.top} />}
      <View style={styles.row}>
        {onHome ? (
          <IconButton glyph="hearth" label={t('common.toHearth')} onPress={onHome} />
        ) : onBack ? (
          <IconButton glyph="back" label={t('common.back')} onPress={onBack} />
        ) : (
          <View style={styles.slot} />
        )}
        {sign ? (
          <View style={[styles.title, styles.signSlot]} />
        ) : (
          <Txt
            variant="titleRoom"
            color="textAccent"
            align="center"
            numberOfLines={1}
            // a long room name (Mongolian runs ~1.4× English) shrinks to fit rather than losing its end
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={styles.title}
            accessibilityRole="header"
          >
            {title}
          </Txt>
        )}
        {action ? <IconButton {...action} /> : <View style={styles.slot} />}
      </View>
      <Art name="dry_brush_rule" style={styles.rule} fit="stretch" />
    </View>
  );
}

const SIGN_W = 300;
const PLANK_H = 64;
/** The plank hangs this far below the status bar; only the chains cross it, so the clock stays clear. */
const PLANK_DROP = 4;
const SWAY = [2.2, -1.5, 0.9, -0.4, 0];

/**
 * The name on a brass plank hung from two chains. As the room opens the sign settles on its
 * chains: a few small sways dying away (once, never a loop — M8).
 */
function HangingSign({ title, top }: { title: string; top: number }) {
  const reduce = useReduceMotion();
  const angle = useSharedValue(reduce ? 0 : (SWAY[0] ?? 0));
  useEffect(() => {
    if (reduce) return;
    angle.value = withSequence(
      ...SWAY.slice(1).map((a) => withTiming(a, { duration: 260, easing: curve('breathe') })),
    );
  }, [angle, reduce]);
  const sway = useAnimatedStyle(() => ({
    transformOrigin: 'top',
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sign, { height: top + PLANK_DROP + PLANK_H }, sway]}>
      <Art
        name="sign_chain"
        style={[styles.chain, styles.chainL, { height: top + PLANK_DROP }]}
        fit="stretch"
      />
      <Art
        name="sign_chain"
        style={[styles.chain, styles.chainR, { height: top + PLANK_DROP }]}
        fit="stretch"
      />
      <View style={[styles.plank, { top: top + PLANK_DROP }]}>
        <FillArt name="sign_plank" />
        <Art name="screw_a" style={[styles.bolt, styles.boltL]} />
        <Art name="screw_c" style={[styles.bolt, styles.boltR]} />
        <Art name="makers_mark" style={styles.mark} />
        <Txt
          variant="titleRoom"
          color="textInverse"
          engraved
          align="center"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={styles.signName}
          accessibilityRole="header"
        >
          {title}
        </Txt>
      </View>
    </Animated.View>
  );
}

function IconButton({ glyph, label, onPress }: Action) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.slot}
    >
      <Glyph name={glyph} size={24} tint="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: dimension.sizeGutter, paddingBottom: dimension.space3, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  slot: { width: 24, height: 24 },
  // an Image needs an explicit width; alignSelf: 'stretch' leaves it at the art's own width
  rule: { width: '100%', height: 4 },
  sign: { position: 'absolute', top: 0, alignSelf: 'center', width: SIGN_W, zIndex: 1 },
  chain: { position: 'absolute', top: 0, width: 10 },
  chainL: { left: 55 },
  chainR: { left: 235 },
  plank: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PLANK_H,
    justifyContent: 'center',
    paddingHorizontal: 44,
    overflow: 'hidden',
  },
  bolt: { position: 'absolute', top: 25, width: 14, height: 14 },
  boltL: { left: 16 },
  boltR: { right: 16 },
  mark: { position: 'absolute', top: 44, right: 40, width: 14, height: 14 },
  signName: { fontSize: 30, lineHeight: 39 },
  // the row is as tall as the hanging plank (less the header's top padding), so the rule stays under it
  signSlot: { height: PLANK_DROP + PLANK_H + 6 - dimension.space3 },
});
