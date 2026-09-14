import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier, tierLabel } from '../../lib/tiers';
import { oathLabel } from '../OathSigil';
import { cap } from '../../lib/fire';
import { countWord } from '../../lib/worldTime';
import { CardEyebrow } from '../ui/CardEyebrow';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, METAL, RADIUS, SPACE, SURFACE, TRACKING } from '../../lib/theme';
import { formatNumber } from '../../lib/numerals';
import { ORNAMENTS } from '../../lib/ornaments';
import { i18n } from '../../lib/i18n';
import type { GemTier, Oath } from '../../models/user';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
  oath: Oath | null;
  /**
   * The poster's voice ("honestly kept") is never a claim of proof — it names the oath sworn,
   * not whether it was earned — so an unproven oath reads exactly like a proven one here.
   * Accepted (rather than dropped) for the test's sake and reserved: a future ceremony treatment
   * (a different seal, say) has somewhere to read it from without threading a second prop through
   * `profile.tsx` and `ShareCharacterButton` later.
   */
  oathProven: boolean;
}

// Exported so `ShareCharacterButton`'s preview scales against the poster's real dimensions
// rather than a second, easily-drifting copy of the same two numbers.
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 520;

export function CharacterCard({ displayName, photoUrl, gemTier, totalScore, currentStreak, oath, oathProven: _oathProven }: Props) {
  const tierColor = colorForTier(gemTier);
  const wantedFor = oath
    ? i18n.t('wanted_for', { oath: oathLabel(oath) })
    : i18n.t('wanted_for_none');
  // `cap` (exported from `lib/fire.ts`, whose own lines are built the same way) gives a
  // sentence-initial capital to a line built from `countWord`, which hands back lowercase words
  // ("three") so it reads correctly mid-sentence everywhere else it is used.
  const streakLine = cap(
    currentStreak === 1
      ? i18n.t('keepsake_line_one')
      : currentStreak > 0
        ? i18n.t('keepsake_line', { dawns: countWord(currentStreak) })
        : i18n.t('keepsake_line_none'),
  );

  return (
    <View style={styles.card}>
      <LinearGradient colors={[SURFACE.raised, SURFACE.panel]} style={StyleSheet.absoluteFill} />
      <Text style={styles.wanted}>{i18n.t('wanted')}</Text>
      <CardEyebrow style={styles.wantedFor}>{wantedFor}</CardEyebrow>
      <View style={styles.portraitFrame}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.portrait}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel={displayName}
          />
        ) : (
          <View style={[styles.portrait, styles.portraitPlaceholder]} />
        )}
        <Image
          source={ORNAMENTS.knotGold}
          testID="ulzii-frame-corner"
          style={styles.portraitKnot}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
      <CardEyebrow color={tierColor} style={styles.gemScore}>
        {i18n.t('tier_score', { tier: tierLabel(gemTier), score: formatNumber(totalScore) })}
      </CardEyebrow>
      <Text style={styles.streak}>{streakLine}</Text>
      <Text style={styles.wordmark}>MingldIngl</Text>
      {/* The ornament, not a wax seal: wax means "binds", and a poster binds no one to anything. */}
      <Image
        source={ORNAMENTS.knotGold}
        testID="ulzii-card-knot"
        style={styles.knot}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    paddingTop: SPACE.xxl,
    paddingHorizontal: SPACE.xxl,
    overflow: 'hidden',
  },
  wanted: {
    fontFamily: FONTS.wordmark,
    fontSize: FONT_SIZES.roomName,
    color: INK.primary,
    letterSpacing: TRACKING.body,
    marginBottom: SPACE.sm,
  },
  wantedFor: { textAlign: 'center', marginBottom: SPACE.xl },
  portraitFrame: { marginBottom: SPACE.xl },
  portrait: { width: 160, height: 190, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: METAL.gold },
  portraitPlaceholder: { backgroundColor: SURFACE.raised },
  portraitKnot: { position: 'absolute', width: 28, height: 28, bottom: -10, right: -10 },
  name: { fontFamily: FONTS.display, fontSize: FONT_SIZES.display, color: INK.primary, marginBottom: SPACE.sm },
  gemScore: { marginBottom: SPACE.xl },
  streak: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    textAlign: 'center',
    paddingHorizontal: SPACE.sm,
  },
  wordmark: {
    position: 'absolute',
    bottom: SPACE.xxl,
    fontFamily: FONTS.wordmark,
    fontSize: FONT_SIZES.md,
    letterSpacing: TRACKING.ceremony,
    color: INK.dim,
  },
  knot: { position: 'absolute', width: ICON_SIZES.xl, height: ICON_SIZES.xl, bottom: SPACE.xl, right: SPACE.xl },
});
