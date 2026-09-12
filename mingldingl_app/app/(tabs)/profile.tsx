import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Tap } from '../../components/ui/Tap';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { useProfile } from '../../hooks/useProfile';
import { useScoreDetail } from '../../hooks/useScoreDetail';
import { useInventory } from '../../hooks/useInventory';
import { useMilestones } from '../../hooks/useMilestones';
import { useDailyMatchBudget } from '../../hooks/useScore';
import { colorForTier, itemLabel, membershipLabel } from '../../lib/tiers';
import { AppCard } from '../../components/ui/AppCard';
import { CardEyebrow } from '../../components/ui/CardEyebrow';
import { CountText } from '../../components/ui/CountText';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { Icon } from '../../components/ui/Icon';
import { SectionDivider } from '../../components/ui/SectionDivider';
import { XPBar } from '../../components/progression/XPBar';
import { GemTierBadge } from '../../components/progression/GemTierBadge';
import { GettingStartedCard } from '../../components/progression/GettingStartedCard';
import { DailyBudgetMeter } from '../../components/progression/DailyBudgetMeter';
import { InviteAllyCard } from '../../components/progression/InviteAllyCard';
import { ThreadLog } from '../../components/progression/ThreadLog';
import { HonourCase } from '../../components/progression/HonourCase';
import { NextActionCard } from '../../components/NextActionCard';
import { ShareCharacterButton } from '../../components/cards/ShareCharacterButton';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { OathCard } from '../../components/profile/OathCard';
import { DeletionPendingBanner } from '../../components/profile/DeletionPendingBanner';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCancelDeletion } from '../../hooks/useCancelDeletion';
import { ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, RADIUS, SPACE, TRACKING } from '../../lib/theme';
import type { GemTier } from '../../models/user';

export default function ProfileScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const cancelDeletion = useCancelDeletion();
  const { data: profile } = useProfile();
  const { data: scoreDetail } = useScoreDetail();
  const { items } = useInventory();
  const { milestones } = useMilestones();
  const dailyBudget = useDailyMatchBudget();

  if (!profile || !scoreDetail) {
    return (
      <View style={styles.loadingScreen}>
        <Skeleton width={100} height={100} radius={RADIUS.pill} style={styles.loadingAvatar} />
        <Skeleton width="50%" height={FONT_SIZES.title} style={styles.loadingName} />
        <View style={styles.loadingXpWrap}>
          <Skeleton width="100%" height={14} radius={RADIUS.sm} />
        </View>
      </View>
    );
  }

  const gemTier = (scoreDetail.gemTier as GemTier) ?? 'Garnet';
  const nextTier = scoreDetail.nextTier as GemTier | null;
  const firstPhoto = profile.photoUrls?.[0];
  const tierColor = colorForTier(gemTier);
  const achievedMilestoneIds = milestones.filter((m) => m.achievedAt).map((m) => m.id ?? '');

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameHeader title={i18n.t('character_sheet')} glyph="gem" />

        {profile.deletionRequestedAt && (
          <DeletionPendingBanner
            graceDays={profile.deletionGraceDays}
            onCancel={() => cancelDeletion.mutate()}
            isCancelling={cancelDeletion.isPending}
          />
        )}

        <ProfileAvatar photoUrls={profile.photoUrls ?? []} tierColor={tierColor} />

        <View style={styles.nameRow}>
          <View style={styles.nameBlock}>
            <Text style={styles.displayName} numberOfLines={2}>{profile.displayName}</Text>
            {profile.equippedTitleId && (
              <Text style={styles.equippedTitle}>{itemLabel(profile.equippedTitleId)}</Text>
            )}
            <Text style={styles.subText}>{profile.age} · {profile.city}</Text>
          </View>
          <GemTierBadge tier={gemTier} size={BADGE_SIZES.hero} glow />
        </View>

        <NextActionCard />

        <Tap style={styles.card} onPress={() => router.push('/progression')}>
          <AppCard tier={gemTier} style={styles.cardPadding}>
            <XPBar
              gemTier={gemTier}
              totalScore={scoreDetail.totalScore ?? 0}
              pct={(scoreDetail.progressPct ?? 0) / 100}
              nextTier={nextTier}
            />
          </AppCard>
        </Tap>

        <AppCard tier={gemTier} style={[styles.card, styles.cardPadding]}>
          <CardEyebrow>{i18n.t('total_score')}</CardEyebrow>
          <Text style={styles.scoreValue}><CountText value={scoreDetail.totalScore ?? 0} /> {i18n.t('pts')}</Text>
          <SectionDivider />
          <Tap onPress={() => router.push('/membership')}>
            <CardEyebrow>{i18n.t('guild_rank')}</CardEyebrow>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipValue}>{membershipLabel(profile.membershipLevel)}</Text>
              <Icon name="chevron-right" size={ICON_SIZES.lg} color={ACCENT.base} />
            </View>
          </Tap>
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
          <Text style={styles.bioText}>{profile.bio}</Text>
        </AppCard>

        {/* Moved off Seek (task-8): below the character's own identity/stat cards, above the rest
            of the sheet. Both keep their own visibility logic — GettingStartedCard hides itself
            once every step is done, DailyBudgetMeter only when a budget is known. */}
        <GettingStartedCard
          isProfileComplete={profile.isProfileComplete}
          achievedMilestoneIds={achievedMilestoneIds}
          onCompleteProfile={() => router.push('/edit-profile')}
        />
        {dailyBudget && <DailyBudgetMeter budget={dailyBudget} />}

        <InviteAllyCard referralCode={profile.referralCode} />

        <ThreadLog ownedItemIds={items.map((i) => i.itemId ?? '')} />

        <HonourCase />

        <View style={styles.editButtonWrapper}>
          <GameButton variant="ink" size="compact" icon="book-heart" onPress={() => router.push('/date-log')}>
            {i18n.t('view_date_log')}
          </GameButton>
        </View>

        <View style={styles.editButtonWrapper}>
          <GameButton variant="ink" size="compact" onPress={() => router.push('/edit-profile')}>
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
          <GameButton variant="ink" size="compact" icon="cog-outline" onPress={() => router.push('/settings')}>
            {i18n.t('settings_title')}
          </GameButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  loadingScreen: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', paddingTop: SPACE.giant },
  loadingAvatar: { marginBottom: SPACE.xl },
  loadingName: { marginBottom: SPACE.xl },
  loadingXpWrap: { width: '100%', paddingHorizontal: SPACE.gutter },
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
    fontSize: FONT_SIZES.hero,
    lineHeight: LEADING.hero,
    fontFamily: FONTS.display,
    color: INK.primary,
    marginBottom: SPACE.xs,
  },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: ACCENT.base, letterSpacing: TRACKING.wide, marginTop: SPACE.hair },
  subText: { fontSize: FONT_SIZES.md, color: INK.dim, fontFamily: FONTS.body },
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  cardPadding: { padding: SPACE.lg },
  scoreValue: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.display,
    color: ACCENT.base,
  },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  // Both halves carry the same size and leading, or `alignItems: center` centres two line boxes
  // of different heights and the arrow reads as having slipped below the word.
  membershipValue: {
    fontSize: FONT_SIZES.lg, lineHeight: LEADING.lg,
    fontFamily: FONTS.bodyBold, color: INK.primary,
  },
  bioText: { fontSize: FONT_SIZES.md, color: INK.dim, lineHeight: LEADING.md, fontFamily: FONTS.body },
  editButtonWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm },
  signOutWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.md },
});
