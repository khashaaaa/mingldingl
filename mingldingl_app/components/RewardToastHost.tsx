import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LootToast } from './modals/LootToast';
import { useAuthStore } from '../store/authStore';
import { useScoreDetail } from '../hooks/useScoreDetail';
import { apiClient } from '../lib/api/apiClient';
import { i18n } from '../lib/i18n';
import { queryKeys } from '../lib/api/queryKeys';
import { toDroppedItem, tierLabel } from '../lib/tiers';
import type { components } from '../lib/api/api.generated';

type ScoreDetailResponse = components['schemas']['ScoreDetailResponse'];

const TOAST_BOTTOM_OFFSET = 68;

export function RewardToastHost() {
  const queryClient = useQueryClient();
  const { data: scoreDetail } = useScoreDetail();
  const streakBonusPending = useAuthStore((s) => s.streakBonusPending);
  const setStreakBonusPending = useAuthStore((s) => s.setStreakBonusPending);
  const pendingDrop = useAuthStore((s) => s.pendingDrop);
  const setPendingDrop = useAuthStore((s) => s.setPendingDrop);
  const pendingTierUp = useAuthStore((s) => s.pendingTierUp);
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);

  useEffect(() => {
    if (pendingDrop) return;
    const referralDrop = toDroppedItem(scoreDetail?.pendingReferralReward);
    const shipDrop = toDroppedItem(scoreDetail?.pendingShipReward);
    const kind: 'referral' | 'ship' | null = referralDrop ? 'referral' : shipDrop ? 'ship' : null;
    const drop = referralDrop ?? shipDrop;
    if (!kind || !drop) return;
    setPendingDrop(drop);

    queryClient.setQueryData<ScoreDetailResponse>(queryKeys.scoreDetail, (old) =>
      old
        ? { ...old, [kind === 'referral' ? 'pendingReferralReward' : 'pendingShipReward']: undefined }
        : old,
    );

    apiClient.scores.ackNotification(kind).catch(() => {});
  }, [scoreDetail?.pendingReferralReward, scoreDetail?.pendingShipReward, pendingDrop, setPendingDrop, queryClient]);

  if (pendingTierUp) {
    return (
      <LootToast
        key="tier-up"
        title={i18n.t('tier_up_title', { tier: tierLabel(pendingTierUp) })}
        points={0}
        visible
        onDismiss={() => setPendingTierUp(null)}
        bottomOffset={TOAST_BOTTOM_OFFSET}
      />
    );
  }
  if (streakBonusPending) {
    return (
      <LootToast
        key="streak-bonus"
        title={i18n.t('streak_bonus_title')}
        points={50}
        visible
        onDismiss={() => setStreakBonusPending(false)}
        bottomOffset={TOAST_BOTTOM_OFFSET}
      />
    );
  }
  if (pendingDrop) {
    return (
      <LootToast
        key={`drop-${pendingDrop.nameKey}`}
        title={i18n.t('loot_found')}
        points={0}
        item={pendingDrop}
        visible
        onDismiss={() => setPendingDrop(null)}
        bottomOffset={TOAST_BOTTOM_OFFSET}
      />
    );
  }
  return null;
}
