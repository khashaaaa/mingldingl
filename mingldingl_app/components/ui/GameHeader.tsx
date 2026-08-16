import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ScoreHUD } from '../progression/ScoreHUD';
import { SectionDivider } from './SectionDivider';
import { LootToast } from '../modals/LootToast';
import { Icon } from './Icon';
import { useAuthStore } from '../../store/authStore';
import { useScoreDetail } from '../../hooks/useScoreDetail';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { queryKeys } from '../../lib/api/queryKeys';
import { toDroppedItem } from '../../lib/tiers';
import type { components } from '../../lib/api/api.generated';

type ScoreDetailResponse = components['schemas']['ScoreDetailResponse'];

interface Props {
  title: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  showScore?: boolean;
  onBack?: () => void;
  showBack?: boolean;
  // Screens rendered inside the (tabs) group sit above the bottom tab bar
  // — the default clears it. Screens outside the tab group (leaderboard,
  // progression, date-log) pass 0 since there's nothing to clear.
  toastBottomOffset?: number;
}

export function GameHeader({ title, icon, showScore = false, onBack, showBack = false, toastBottomOffset = 68 }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: scoreDetail } = useScoreDetail();
  const streakBonusPending = useAuthStore((s) => s.streakBonusPending);
  const setStreakBonusPending = useAuthStore((s) => s.setStreakBonusPending);
  const pendingDrop = useAuthStore((s) => s.pendingDrop);
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const pendingTierUp = useAuthStore((s) => s.pendingTierUp);
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);
  useEffect(() => {
    const referralDrop = toDroppedItem(scoreDetail?.pendingReferralReward);
    const shipDrop = toDroppedItem(scoreDetail?.pendingShipReward);
    if (referralDrop) {
      setPendingDrop(referralDrop);
      // The reward is read-once server-side, but the query cache keeps it
      // around for staleTime (60s). GameHeader remounts fresh on every
      // screen (discover, matches, activity, profile, leaderboard,
      // progression, date-log) — without clearing it here, navigating to a
      // new screen within that window would re-trigger setPendingDrop with
      // the SAME already-dismissed reward. Clear it from the cache the
      // moment it's consumed so a later mount sees nothing pending.
      queryClient.setQueryData<ScoreDetailResponse>(queryKeys.scoreDetail, (old) =>
        old ? { ...old, pendingReferralReward: undefined } : old
      );
    } else if (shipDrop) {
      setPendingDrop(shipDrop);
      queryClient.setQueryData<ScoreDetailResponse>(queryKeys.scoreDetail, (old) =>
        old ? { ...old, pendingShipReward: undefined } : old
      );
    }
  }, [scoreDetail?.pendingReferralReward, scoreDetail?.pendingShipReward, setPendingDrop, queryClient]);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {showBack && (
            <TouchableOpacity onPress={onBack ?? (() => router.back())} style={styles.backBtn} accessibilityLabel="Go back">
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          )}
          {icon && <Icon name={icon} size={20} style={styles.titleIcon} />}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        {showScore && scoreDetail && (
          <ScoreHUD score={scoreDetail.totalScore ?? 0} tier={(scoreDetail.gemTier ?? undefined) as string | undefined} streak={scoreDetail.currentStreak} />
        )}
      </View>
      <SectionDivider tint={COLORS.gold} />
      {/* One of these three can flip true at the same moment (a daily-login
          response can carry a streak bonus and a tier crossing together) —
          show only the highest-priority one at a time. Each still owns
          clearing just its own flag, so once it's dismissed, the next
          pending one (if any) becomes active on the following render
          instead of all three stacking illegibly. */}
      {pendingTierUp ? (
        <LootToast
          title={i18n.t('tier_up_title', { tier: pendingTierUp })}
          points={0}
          visible
          onDismiss={() => setPendingTierUp(null)}
          bottomOffset={toastBottomOffset}
        />
      ) : streakBonusPending ? (
        <LootToast
          title={i18n.t('streak_bonus_title')}
          points={50}
          visible
          onDismiss={() => setStreakBonusPending(false)}
          bottomOffset={toastBottomOffset}
        />
      ) : pendingDrop ? (
        <LootToast
          title={i18n.t('loot_found')}
          points={0}
          item={pendingDrop}
          visible
          onDismiss={() => setPendingDrop(null)}
          bottomOffset={toastBottomOffset}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  titleIcon: { marginTop: 2 },
  backBtn: { padding: 4, marginRight: 4 },
  backText: { color: COLORS.gold, fontSize: 22, fontFamily: FONTS.bodyMedium },
  title: {
    fontFamily: FONTS.displayBlack,
    fontSize: 24,
    color: COLORS.text,
    letterSpacing: 1.5,
    flexShrink: 1,
  },
});
