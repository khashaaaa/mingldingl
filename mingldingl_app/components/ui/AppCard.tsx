import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { ACCENT, LINE, RADIUS, SCRIM, SURFACE, glow, overlay, tint as tintColor } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { useActiveFestival } from '../../lib/festivals';

interface Props {
  children: React.ReactNode;
  tier?: string;

  tint?: string;
  /**
   * The one panel a screen is *for*. Knots, parchment and the glow are its alone — the kit's
   * rule is "one hero panel, then rows", and "its glow is the only glow". Every other card keeps
   * the panel fill, the hairline, the top highlight and the border, and gives up the ornament
   * and both shadows, so it lies flat on the floor. At most one per screen; the rule is enforced
   * in `lib/__tests__/hero.test.ts`.
   */
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, tier, tint: tintOverride, hero, style }: Props) {
  const tint = tintOverride ?? (tier ? colorForTier(tier) : ACCENT.base);
  // On a festival day the gold knots take the festival's colour. The PNGs are metal-shaded over
  // alpha, so tintColor flattens them to one colour while keeping their shape.
  const festival = useActiveFestival();
  const knotTint = festival ? { tintColor: festival.color } : undefined;
  return (
    <View testID="app-card" style={[styles.card, hero && glow(tint, 0.35, 12, 6), style]}>
      <LinearGradient
        colors={[SURFACE.raised, SURFACE.panel]}
        style={styles.fill}
        pointerEvents="none"
      />
      {hero && (
        <View style={styles.texture} testID="parchment-texture" pointerEvents="none">
          <Image
            source={require('../../assets/textures/parchment.png')}
            style={styles.textureImage}
            resizeMode="cover"
          />
        </View>
      )}
      <View style={styles.hairline} pointerEvents="none" />
      <View style={[styles.topHighlight, { backgroundColor: tintColor(tint, 0.4) }]} pointerEvents="none" />
      {hero && <View style={styles.bottomShadow} testID="card-bottom-shadow" pointerEvents="none" />}
      {hero && (
        <>
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTl, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTr, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBl, knotTint]} />
          <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBr, knotTint]} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
  },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md },
  texture: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md, overflow: 'hidden', opacity: 0.06 },
  textureImage: { width: '100%', height: '100%' },
  topHighlight: { position: 'absolute', top: 0, left: RADIUS.md, right: RADIUS.md, height: 1 },
  bottomShadow: { position: 'absolute', bottom: 0, left: RADIUS.md, right: RADIUS.md, height: 1, backgroundColor: overlay(SCRIM.edge) },
  hairline: {
    position: 'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderWidth: 1,
    borderColor: ACCENT.line,
    borderRadius: RADIUS.sm,
  },
  knot: { position: 'absolute', width: 24, height: 24, pointerEvents: 'none' },
  knotTl: { top: -6, left: -6 },
  knotTr: { top: -6, right: -6, transform: [{ scaleX: -1 }] },
  knotBl: { bottom: -6, left: -6, transform: [{ scaleY: -1 }] },
  knotBr: { bottom: -6, right: -6, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
});
