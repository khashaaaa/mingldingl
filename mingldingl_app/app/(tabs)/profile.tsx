import {
  Text,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { useProfile } from '../../hooks/useProfile';
import { useScoreDetail } from '../../hooks/useScoreDetail';
import { useInventory } from '../../hooks/useInventory';
import { colorForTier, itemLabel, membershipLabel, FRAME_COLORS } from '../../lib/tiers';
import { AppCard } from '../../components/ui/AppCard';
import { CardEyebrow } from '../../components/ui/CardEyebrow';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { SectionDivider } from '../../components/ui/SectionDivider';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { XPBar } from '../../components/progression/XPBar';
import { GemTierBadge } from '../../components/progression/GemTierBadge';
import { InviteAllyCard } from '../../components/progression/InviteAllyCard';
import { ThreadLog } from '../../components/progression/ThreadLog';
import { TrophyCase } from '../../components/progression/TrophyCase';
import { NextActionCard } from '../../components/NextActionCard';
import { ShareCharacterButton } from '../../components/cards/ShareCharacterButton';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { OathCard } from '../../components/profile/OathCard';
import { COLORS, FONTS, FONT_SIZES, LINE_HEIGHTS, SPACE } from '../../lib/theme';
import type { GemTier } from '../../models/user';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ProfileScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: scoreDetail } = useScoreDetail();
  const { items } = useInventory();

  if (!profile || !scoreDetail) {
    return (
      <View style={styles.loadingScreen}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  const gemTier = (scoreDetail.gemTier as GemTier) ?? 'Garnet';
  const nextTier = scoreDetail.nextTier as GemTier | null;
  const firstPhoto = profile.photoUrls?.[0];
  const tierColor = colorForTier(gemTier);
  const frameColor = (profile.equippedFrameId && FRAME_COLORS[profile.equippedFrameId]) ?? tierColor;

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameHeader title={i18n.t('character_sheet')} icon="shield-sword" />

        <ProfileAvatar photoUrls={profile.photoUrls ?? []} tierColor={tierColor} frameColor={frameColor} />

        <View style={styles.nameRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.equippedTitleId && (
              <Text style={styles.equippedTitle}>{itemLabel(profile.equippedTitleId)}</Text>
            )}
            <Text style={styles.subText}>{profile.age} · {profile.city}</Text>
          </View>
          <GemTierBadge tier={gemTier} size={44} glow />
        </View>

        <NextActionCard />

        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push('/progression')}>
          <AppCard tier={gemTier} textured style={styles.cardPadding}>
            <XPBar
              gemTier={gemTier}
              totalScore={scoreDetail.totalScore ?? 0}
              pct={(scoreDetail.progressPct ?? 0) / 100}
              nextTier={nextTier}
            />
          </AppCard>
        </TouchableOpacity>

        <AppCard tier={gemTier} textured style={[styles.card, styles.cardPadding]}>
          <CardEyebrow>{i18n.t('total_score')}</CardEyebrow>
          <Text style={styles.scoreValue}>{(scoreDetail.totalScore ?? 0).toLocaleString()} {i18n.t('pts')}</Text>
          <SectionDivider />
          <TouchableOpacity onPress={() => router.push('/membership')}>
            <CardEyebrow>{i18n.t('guild_rank')}</CardEyebrow>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipValue}>{membershipLabel(profile.membershipLevel)}</Text>
              <Text style={styles.membershipArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </AppCard>

        <OathCard
          oath={profile.oath}
          oathProven={profile.oathProven}
          encountersHeld={profile.oathEncountersHeld}
          encountersNeeded={profile.oathEncountersNeeded}
          gemTier={gemTier}
          style={[styles.card, styles.cardPadding]}
        />

        <AppCard style={[styles.card, styles.cardPadding]}>
          <CardEyebrow>{i18n.t('bio')}</CardEyebrow>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </AppCard>

        <InviteAllyCard referralCode={profile.referralCode} />

        <ThreadLog ownedItemIds={items.map((i) => i.itemId ?? '')} />

        <TrophyCase />

        <View style={styles.editButtonWrapper}>
          <GameButton variant="brass" size="compact" icon="book-heart" onPress={() => router.push('/date-log')}>
            {i18n.t('view_date_log')}
          </GameButton>
        </View>

        <View style={styles.editButtonWrapper}>
          <GameButton variant="brass" size="compact" onPress={() => router.push('/edit-profile')}>
            {i18n.t('edit_profile')}
          </GameButton>
        </View>

        <View style={styles.editButtonWrapper}>
          <ShareCharacterButton
            displayName={profile.displayName}
            photoUrl={firstPhoto}
            gemTier={gemTier}
            totalScore={scoreDetail.totalScore ?? 0}
            currentStreak={scoreDetail.currentStreak ?? 0}
          />
        </View>

        <View style={styles.signOutWrapper}>
          <GameButton variant="brass" size="compact" icon="cog-outline" onPress={() => router.push('/settings')}>
            {i18n.t('settings_title')}
          </GameButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: SPACE.scrollTail },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.gutter,
    marginBottom: SPACE.xl,
  },
  nameBlock: { flex: 1 },
  displayName: {
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.display,
    color: COLORS.text,
    marginBottom: SPACE.xs,
  },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: COLORS.gold, letterSpacing: 1, marginTop: SPACE.hair },
  subText: { fontSize: FONT_SIZES.md, color: COLORS.textDim, fontFamily: FONTS.body },
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  cardPadding: { padding: SPACE.lg },
  scoreValue: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.displayBlack,
    color: COLORS.gold,
  },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  membershipValue: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: COLORS.text },
  membershipArrow: { fontSize: FONT_SIZES.md, color: COLORS.gold, fontFamily: FONTS.body },
  bioText: { fontSize: FONT_SIZES.md, color: COLORS.textDim, lineHeight: LINE_HEIGHTS.md, fontFamily: FONTS.body },
  editButtonWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm },
  signOutWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.md },
});
