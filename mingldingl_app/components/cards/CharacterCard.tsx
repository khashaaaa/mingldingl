import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { colorForTier, tierLabel } from '../../lib/tiers';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE, circle } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { i18n } from '../../lib/i18n';
import type { GemTier } from '../../models/user';
import { Icon } from '../ui/Icon';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
}

const WIDTH = 360;
const HEIGHT = 520;

export function CharacterCard({ displayName, photoUrl, gemTier, totalScore, currentStreak }: Props) {
  const tierColor = colorForTier(gemTier);
  return (
    <View style={styles.card}>
      <LinearGradient colors={[COLORS.panelRaised, COLORS.bg]} style={StyleSheet.absoluteFill} />
      <View style={[styles.border, { borderColor: tierColor }]} />
      <Image source={ORNAMENTS.fretGold} testID="ulzii-frame-edge" style={[styles.frameEdge, styles.frameTop]} />
      <Image source={ORNAMENTS.fretGold} testID="ulzii-frame-edge" style={[styles.frameEdge, styles.frameBottom]} />
      <Image source={ORNAMENTS.fretGold} testID="ulzii-frame-edge" style={[styles.frameEdge, styles.frameLeft]} />
      <Image source={ORNAMENTS.fretGold} testID="ulzii-frame-edge" style={[styles.frameEdge, styles.frameRight]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-frame-corner" style={[styles.frameKnot, styles.fkTl]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-frame-corner" style={[styles.frameKnot, styles.fkTr]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-frame-corner" style={[styles.frameKnot, styles.fkBl]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-frame-corner" style={[styles.frameKnot, styles.fkBr]} />
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}
      <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
      <View style={styles.tierRow}>
        <GemTierBadge tier={gemTier} size={40} />
        <Text
          style={[
            styles.tierName,
            { color: tierColor, textShadowColor: tierColor, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
          ]}
        >
          {tierLabel(gemTier)}
        </Text>
      </View>
      <Text style={styles.score}>{totalScore.toLocaleString()} {i18n.t('pts')}</Text>
      {currentStreak > 0 && (
        <View style={styles.streakRow}>
          <Icon name="fire" size={ICON_SIZES.sm} color={COLORS.ember} />
          <Text style={styles.streak}>{i18n.t('streak_current')}: {currentStreak}</Text>
        </View>
      )}
      <Text style={styles.wordmark}>MingldIngl</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    paddingTop: SPACE.giant,
    paddingHorizontal: SPACE.xxl,
    overflow: 'hidden',
  },
  border: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderRadius: RADIUS.lg },
  frameEdge: { position: 'absolute', opacity: 0.55 },
  frameTop: { top: 8, left: 34, width: 292, height: 9 },
  frameBottom: { bottom: 8, left: 34, width: 292, height: 9, transform: [{ rotate: '180deg' }] },
  // 452-long strips centered on the side rails (x=12.5, y=260), then rotated upright.
  frameLeft: { top: 255.5, left: -213.5, width: 452, height: 9, transform: [{ rotate: '90deg' }] },
  frameRight: { top: 255.5, left: 121.5, width: 452, height: 9, transform: [{ rotate: '-90deg' }] },
  frameKnot: { position: 'absolute', width: 30, height: 30 },
  fkTl: { top: 5, left: 5 },
  fkTr: { top: 5, right: 5, transform: [{ scaleX: -1 }] },
  fkBl: { bottom: 5, left: 5, transform: [{ scaleY: -1 }] },
  fkBr: { bottom: 5, right: 5, transform: [{ scaleX: -1 }, { scaleY: -1 }] },
  avatar: { ...circle(140), marginBottom: SPACE.xl },
  avatarPlaceholder: { backgroundColor: COLORS.panelRaised },
  name: { fontFamily: FONTS.display, fontSize: FONT_SIZES.display, color: COLORS.text, marginBottom: SPACE.lg },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md },
  tierName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, letterSpacing: 0 },
  score: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.gold, marginBottom: SPACE.sm },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xl },
  streak: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  wordmark: {
    position: 'absolute',
    bottom: 24,
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.md,
    letterSpacing: 3,
    color: COLORS.textDim,
  },
});
