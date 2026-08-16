import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { colorForTier } from '../../lib/tiers';
import { COLORS, FONTS } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import type { GemTier } from '../../models/user';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
}

// Fixed pixel size (not flex/responsive) — this is captured by react-native-view-shot
// into a static PNG for sharing outside the app, so it needs a stable layout
// independent of whatever screen it's rendered off-screen against.
const WIDTH = 360;
const HEIGHT = 520;

export function CharacterCard({ displayName, photoUrl, gemTier, totalScore, currentStreak }: Props) {
  const tierColor = colorForTier(gemTier);
  return (
    <View style={styles.card}>
      <LinearGradient colors={[COLORS.panelRaised, COLORS.bg]} style={StyleSheet.absoluteFill} />
      <View style={[styles.border, { borderColor: tierColor }]} />
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}
      <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
      <View style={styles.tierRow}>
        <GemTierBadge tier={gemTier} size={40} />
        {/* Static glow, not GlowText's animated pulse — this card is
            captured once via react-native-view-shot into a still PNG, so a
            looping animation would only ever cost a render, never be seen.
            Glow color follows the gem's own tint (purple for Amethyst, teal
            for Opal, ...) rather than a fixed gold, same as the badge beside it. */}
        <Text
          style={[
            styles.tierName,
            { color: tierColor, textShadowColor: tierColor, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
          ]}
        >
          {gemTier}
        </Text>
      </View>
      <Text style={styles.score}>{totalScore.toLocaleString()} {i18n.t('pts')}</Text>
      {currentStreak > 0 && (
        <Text style={styles.streak}>🔥 {i18n.t('streak_current')}: {currentStreak}</Text>
      )}
      <Text style={styles.wordmark}>MingldIngl</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: 16,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  border: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderRadius: 16 },
  avatar: { width: 140, height: 140, borderRadius: 70, marginBottom: 20 },
  avatarPlaceholder: { backgroundColor: COLORS.panelRaised },
  name: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.text, marginBottom: 16 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  // Gem tier names (Garnet/Opal/Amethyst/...) are proper nouns, never run
  // through i18n.t() — safe ground for a Cyrillic-less blackletter face.
  tierName: { fontFamily: FONTS.wordmark, fontSize: 22, letterSpacing: 0 },
  score: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.gold, marginBottom: 8 },
  streak: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textDim, marginBottom: 20 },
  wordmark: {
    position: 'absolute',
    bottom: 24,
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 3,
    color: COLORS.textDim,
  },
});
