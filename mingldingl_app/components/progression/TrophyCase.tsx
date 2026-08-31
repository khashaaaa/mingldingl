import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { SectionDivider } from '../ui/SectionDivider';
import { AlertModal } from '../modals/AlertModal';
import { ChestModal, type ChestItem } from '../modals/ChestModal';
import { Icon } from '../ui/Icon';
import { useInventory } from '../../hooks/useInventory';
import { useMilestones } from '../../hooks/useMilestones';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { useAuthStore } from '../../store/authStore';
import { RARITY_COLORS } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

type ItemIconName = React.ComponentProps<typeof Icon>['name'];
const TYPE_ICONS: Record<string, ItemIconName> = { Frame: 'image-frame', Title: 'certificate', Emblem: 'shield' };

export function TrophyCase() {
  const { items, equip, isEquipping } = useInventory();
  const { milestones, open, isOpening } = useMilestones();
  const bumpScore = useOptimisticScoreBump();
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);
  const [chest, setChest] = useState<{ xp: number; item?: ChestItem | null; deferredTierUp?: string | null } | null>(null);

  const [chestVisible, setChestVisible] = useState(false);
  const [failAlert, setFailAlert] = useState(false);

  async function handleOpenMilestone(id: string) {
    try {
      const res = await open(id);
      if (!res.alreadyOpened) {
        bumpScore(res.awarded ?? 0);

        const deferredTierUp = useAuthStore.getState().pendingTierUp;
        if (deferredTierUp) setPendingTierUp(null);
        setChest({ xp: res.awarded ?? 0, item: res.item as ChestItem | null, deferredTierUp });
        setChestVisible(true);
      }
    } catch { setFailAlert(true); }
  }

  const unopened = milestones.filter((m) => m.achievedAt && !m.openedAt);

  return (
    <AppCard textured style={styles.card}>
      <Text style={styles.heading}>{i18n.t('trophies').toUpperCase()}</Text>
      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="bone-off" size={28} color={COLORS.bronze} style={styles.emptyIcon} />
          <Text style={styles.empty}>{i18n.t('no_trophies')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.itemId}
              disabled={isEquipping || it.itemType === 'Emblem'}
              onPress={() => equip(it.itemId!)}
              style={[
                styles.slot,
                { borderColor: RARITY_COLORS[it.rarity ?? 'Common'] ?? COLORS.bronze },
                it.equipped && styles.slotEquipped,
              ]}
            >
              <View style={styles.slotIconChip}>
                <Icon name={TYPE_ICONS[it.itemType ?? ''] ?? 'help-circle-outline'} size={20} color={COLORS.gold} />
              </View>
              <Text style={styles.slotName} numberOfLines={2}>{i18n.t(it.nameKey ?? '')}</Text>
              {it.equipped && <Text style={styles.equippedTag}>{i18n.t('equipped')}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {unopened.length > 0 && (
        <>
          <SectionDivider />
          <Text style={styles.heading}>{i18n.t('milestones').toUpperCase()}</Text>
          {unopened.map((m) => (
            <TouchableOpacity key={m.id} disabled={isOpening} onPress={() => handleOpenMilestone(m.id!)} style={styles.milestoneRow}>
              <Icon name="treasure-chest-outline" size={20} color={COLORS.gold} />
              <Text style={styles.milestoneName}>{i18n.t(m.nameKey ?? '')}</Text>
              <Text style={styles.milestoneXp}>+{m.xp}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
      <ChestModal
        visible={chestVisible}
        xp={chest?.xp ?? 0}
        item={chest?.item}
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
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16 },
  heading: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 2, marginBottom: 10 },
  emptyWrap: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  emptyIcon: { opacity: 0.6 },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: '30%', minWidth: 92, borderWidth: 1.5, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelDeep, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 4,
  },
  slotEquipped: { backgroundColor: COLORS.panelRaised },
  slotIconChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  slotName: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.text, textAlign: 'center' },
  equippedTag: { fontFamily: FONTS.display, fontSize: 8, color: COLORS.gold, letterSpacing: 1 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  milestoneName: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
  milestoneXp: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.gold },
});
