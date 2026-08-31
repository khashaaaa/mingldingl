import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { COLORS, RADIUS, overlay } from '../../lib/theme';

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
    <View style={[styles.card, { shadowColor: tint }, style]}>
      <LinearGradient
        colors={[COLORS.panelRaised, COLORS.panel]}
        style={StyleSheet.absoluteFill}
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
      <View style={[styles.corner, styles.tl, { borderColor: tint }]} pointerEvents="none" />
      <View style={[styles.corner, styles.tr, { borderColor: tint }]} pointerEvents="none" />
      <View style={[styles.corner, styles.bl, { borderColor: tint + '99' }]} pointerEvents="none" />
      <View style={[styles.corner, styles.br, { borderColor: tint + '99' }]} pointerEvents="none" />
      <View style={[styles.rivet, styles.rivetTl]} pointerEvents="none" />
      <View style={[styles.rivet, styles.rivetTr]} pointerEvents="none" />
      <View style={[styles.rivet, styles.rivetBl]} pointerEvents="none" />
      <View style={[styles.rivet, styles.rivetBr]} pointerEvents="none" />
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
    overflow: 'hidden',
    elevation: 6,
  },
  texture: { ...StyleSheet.absoluteFillObject, opacity: 0.06 },
  textureImage: { width: '100%', height: '100%' },
  topHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  bottomShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: overlay(0.35) },
  hairline: {
    position: 'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderWidth: 1,
    borderColor: 'rgba(217,127,31,0.22)',
    borderRadius: RADIUS.sm,
  },
  corner: { position: 'absolute', width: 12, height: 12 },
  tl: { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
  rivet: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.goldBright,
    shadowColor: COLORS.goldBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
    elevation: 3,
  },
  rivetTl: { top: 3, left: 3 },
  rivetTr: { top: 3, right: 3 },
  rivetBl: { bottom: 3, left: 3 },
  rivetBr: { bottom: 3, right: 3 },
});
