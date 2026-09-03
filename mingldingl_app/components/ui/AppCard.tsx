import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { COLORS, FILL, RADIUS, glow, overlay } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';

interface Props {
  children: React.ReactNode;
  tier?: string;

  tint?: string;
  textured?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppCard({ children, tier, tint: tintOverride, textured, style }: Props) {
  const tint = tintOverride ?? (tier ? colorForTier(tier) : COLORS.gold);
  return (
    <View style={[styles.card, glow(tint, 0.35, 12, 6), style]}>
      <LinearGradient
        colors={[COLORS.panelRaised, COLORS.panel]}
        style={styles.fill}
        pointerEvents="none"
      />
      {textured && (
        <View style={styles.texture} pointerEvents="none">
          <Image
            source={require('../../assets/textures/parchment.png')}
            style={styles.textureImage}
            resizeMode="cover"
          />
        </View>
      )}
      <View style={styles.hairline} pointerEvents="none" />
      <View style={[styles.topHighlight, { backgroundColor: tint + '66' }]} pointerEvents="none" />
      <View style={styles.bottomShadow} pointerEvents="none" />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTl]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotTr]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBl]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-corner" style={[styles.knot, styles.knotBr]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
  },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md },
  texture: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.md, overflow: 'hidden', opacity: 0.06 },
  textureImage: { width: '100%', height: '100%' },
  topHighlight: { position: 'absolute', top: 0, left: RADIUS.md, right: RADIUS.md, height: 1 },
  bottomShadow: { position: 'absolute', bottom: 0, left: RADIUS.md, right: RADIUS.md, height: 1, backgroundColor: overlay(0.35) },
  hairline: {
    position: 'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderWidth: 1,
    borderColor: FILL.hairline,
    borderRadius: RADIUS.sm,
  },
  knot: { position: 'absolute', width: 24, height: 24, pointerEvents: 'none' },
  knotTl: { top: -6, left: -6 },
  knotTr: { top: -6, right: -6, transform: [{ scaleX: -1 }] },
  knotBl: { bottom: -6, left: -6, transform: [{ scaleY: -1 }] },
  knotBr: { bottom: -6, right: -6, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
});
