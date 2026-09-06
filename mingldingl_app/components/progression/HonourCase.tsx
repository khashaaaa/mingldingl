import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { SectionDivider } from '../ui/SectionDivider';
import { AlertModal } from '../modals/AlertModal';
import { ChestModal } from '../modals/ChestModal';
import { Icon } from '../ui/Icon';
import { useInventory } from '../../hooks/useInventory';
import { useMilestones } from '../../hooks/useMilestones';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { useAuthStore } from '../../store/authStore';
import { METAL_COLORS, TIER_ORDER, colorForTier, frameIdForTier, tierLabel } from '../../lib/tiers';
import { i18n, tKey } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, RADIUS, SPACE, circle } from '../../lib/theme';
import type { GemTier } from '../../models/user';

interface Props {
  gemTier: GemTier;
}

/**
 * Honours earned by deeds, the ring of every tier reached (locked ones shown dim so the ladder is
 * visible), and any unopened feats. Frames are not stored: the engine lists the ones the current
 * tier unlocks, and the locked rows here come from the tier ladder alone.
 */
export function HonourCase({ gemTier }: Props) {
  const { items, equip, isEquipping } = useInventory();
  const { milestones, open, isOpening } = useMilestones();
  const bumpScore = useOptimisticScoreBump();
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);
  const [chest, setChest] = useState<{ xp: number; deferredTierUp?: string | null } | null>(null);
  const [chestVisible, setChestVisible] = useState(false);
  const [failAlert, setFailAlert] = useState(false);

  async function handleOpenMilestone(id: string) {
    try {
      const res = await open(id);
      if (!res.alreadyOpened) {
        bumpScore(res.awarded ?? 0);
        const deferredTierUp = useAuthStore.getState().pendingTierUp;
        if (deferredTierUp) setPendingTierUp(null);
        setChest({ xp: res.awarded ?? 0, deferredTierUp });
        setChestVisible(true);
      }
    } catch { setFailAlert(true); }
  }

  const honours = items.filter((it) => it.itemType === 'Title');
  const tierIndex = TIER_ORDER.indexOf(gemTier);
  const unopened = milestones.filter((m) => m.achievedAt && !m.openedAt);

  return (
    <AppCard textured style={styles.card}>
      <CardEyebrow>{i18n.t('honours')}</CardEyebrow>
      {honours.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="seal-variant" size={ICON_SIZES.xxl} color={INK.muted} style={styles.emptyIcon} />
          <Text style={styles.empty}>{i18n.t('no_honours')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {honours.map((it) => (
            <TouchableOpacity
              key={it.itemId}
              testID={`honour-${it.itemId}`}
              disabled={isEquipping}
              onPress={() => equip(it.itemId!)}
              style={[
                styles.slot,
                { borderColor: METAL_COLORS[it.rarity ?? ''] ?? COLORS.gold },
                it.equipped && styles.slotEquipped,
              ]}
            >
              <View style={styles.slotIconChip}>
                <Icon name="certificate" size={ICON_SIZES.lg} color={METAL_COLORS[it.rarity ?? ''] ?? COLORS.gold} />
              </View>
              <Text style={styles.slotName} numberOfLines={2}>{tKey(it.nameKey)}</Text>
              {it.equipped && <Text style={styles.equippedTag}>{i18n.t('equipped')}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SectionDivider />
      <CardEyebrow>{i18n.t('frames_title')}</CardEyebrow>
      <View style={styles.grid}>
        {TIER_ORDER.map((tier, idx) => {
          const frameId = frameIdForTier(tier);
          const unlocked = idx <= tierIndex;
          const equipped = items.some((it) => it.itemId === frameId && it.equipped);
          const ringColor = unlocked ? colorForTier(tier) : INK.muted;
          return (
            <TouchableOpacity
              key={frameId}
              testID={`frame-${tier}`}
              accessibilityState={{ disabled: !unlocked, selected: equipped }}
              disabled={!unlocked || isEquipping}
              onPress={() => equip(frameId)}
              style={[styles.slot, { borderColor: ringColor }, equipped && styles.slotEquipped, !unlocked && styles.slotLocked]}
            >
              <View style={[styles.ring, { borderColor: ringColor }]} />
              <Text style={styles.slotName} numberOfLines={1}>{tierLabel(tier)}</Text>
              {equipped && <Text style={styles.equippedTag}>{i18n.t('equipped')}</Text>}
              {!unlocked && (
                <Text style={styles.lockedTag} numberOfLines={2}>{i18n.t('frame_locked_at', { tier: tierLabel(tier) })}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {unopened.length > 0 && (
        <>
          <SectionDivider />
          <CardEyebrow>{i18n.t('milestones')}</CardEyebrow>
          {unopened.map((m) => (
            <TouchableOpacity key={m.id} disabled={isOpening} onPress={() => handleOpenMilestone(m.id!)} style={styles.milestoneRow}>
              <Icon name="treasure-chest-outline" size={ICON_SIZES.lg} color={COLORS.gold} />
              <Text style={styles.milestoneName}>{tKey(m.nameKey)}</Text>
              <Text style={styles.milestoneXp}>+{m.xp}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
      <ChestModal
        visible={chestVisible}
        xp={chest?.xp ?? 0}
        onDismiss={() => {
          if (chest?.deferredTierUp) setPendingTierUp(chest.deferredTierUp);
          setChestVisible(false);
        }}
      />
      <AlertModal
        visible={failAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setFailAlert(false)}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg },
  emptyWrap: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xs },
  emptyIcon: { opacity: 0.6 },
  empty: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  slot: {
    width: '30%', minWidth: 92, borderWidth: 2, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelDeep, alignItems: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, gap: SPACE.xs,
  },
  slotEquipped: { backgroundColor: COLORS.panelRaised },
  slotLocked: { opacity: 0.45 },
  slotIconChip: {
    ...circle(36),
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: { ...circle(36), borderWidth: 3, backgroundColor: COLORS.panelRaised },
  slotName: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.xs, color: COLORS.text, textAlign: 'center' },
  equippedTag: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: COLORS.gold, letterSpacing: 1 },
  lockedTag: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textDim, textAlign: 'center' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  milestoneName: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.text },
  milestoneXp: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: COLORS.gold },
});
