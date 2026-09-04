import { useState } from 'react';
import { CardEyebrow } from '../ui/CardEyebrow';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { AlertModal } from '../modals/AlertModal';
import { ChestModal, type ChestItem } from '../modals/ChestModal';
import { Icon } from '../ui/Icon';
import { EmberField } from '../vfx/EmberField';
import { useQuests } from '../../hooks/useQuests';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { useAuthStore } from '../../store/authStore';
import { activeFestival } from '../../lib/festivals';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE } from '../../lib/theme';

function ProgressPips({ progress, target }: { progress: number; target: number }) {
  if (target === 1) return null;
  return (
    <View style={styles.pips}>
      {Array.from({ length: target }).map((_, i) => (
        <View key={i} style={[styles.pip, i < progress && styles.pipFilled]} />
      ))}
    </View>
  );
}

export function QuestBoard() {
  const { board, isLoading, claimChest, isClaiming } = useQuests();
  const bumpScore = useOptimisticScoreBump();
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);
  const [chest, setChest] = useState<{ xp: number; item?: ChestItem | null; deferredTierUp?: string | null } | null>(null);

  const [chestVisible, setChestVisible] = useState(false);
  const [headingWidth, setHeadingWidth] = useState(0);
  const [failAlert, setFailAlert] = useState(false);

  if (isLoading || !board) return null;

  const festival = activeFestival();
  const accent = festival?.color ?? COLORS.gold;
  const headingIcon = festival?.icon ?? 'anvil';
  const headingText = festival ? i18n.t(festival.nameKey) : i18n.t('quest_board');

  function onHeadingLayout(e: LayoutChangeEvent) {
    setHeadingWidth(e.nativeEvent.layout.width);
  }

  async function handleClaim() {
    try {
      const res = await claimChest();
      if (!res.alreadyClaimed) {
        bumpScore(res.awarded ?? 0);

        const deferredTierUp = useAuthStore.getState().pendingTierUp;
        if (deferredTierUp) setPendingTierUp(null);
        setChest({ xp: res.awarded ?? 0, item: res.item as ChestItem | null, deferredTierUp });
        setChestVisible(true);
      }
    } catch { setFailAlert(true); }
  }

  return (
    <>
      <AppCard textured style={styles.card}>
        <View style={styles.headingRow} onLayout={onHeadingLayout}>
          <View style={styles.headingLabel}>
            <Icon name={headingIcon} size={ICON_SIZES.md} color={accent} />
            <CardEyebrow color={accent} style={styles.heading}>{headingText}</CardEyebrow>
          </View>
          {headingWidth > 0 && <EmberField width={headingWidth} height={30} density={4} />}
        </View>
        {board.quests?.map((q) => (
          <View key={q.questId} style={styles.questRow}>
            <View style={[styles.rune, !q.completed && { borderColor: accent + '66', backgroundColor: accent + '15' }, q.completed && styles.runeDone]}>
              {q.completed ? (
                <Text style={[styles.runeText, styles.runeTextDone]}>✓</Text>
              ) : (
                <Icon name="sword-cross" size={ICON_SIZES.sm} color={accent} />
              )}
            </View>
            <View style={styles.questInfo}>
              <Text style={[styles.questName, q.completed && styles.questNameDone]}>
                {i18n.t(q.nameKey ?? '', { target: q.target })}
              </Text>
              <ProgressPips progress={q.progress ?? 0} target={q.target ?? 1} />
            </View>
            <Text style={styles.questXp}>+{q.xp}</Text>
          </View>
        ))}
        <View style={styles.chestRow}>
          <Icon
            name={board.chestClaimed ? 'treasure-chest' : 'treasure-chest-outline'}
            size={ICON_SIZES.xl}
            color={board.chestClaimed ? COLORS.textDim : accent}
          />
          {board.chestClaimed ? (
            <Text style={styles.chestHint}>{i18n.t('chest_claimed')}</Text>
          ) : board.allComplete ? (
            <View style={styles.chestBtn}>
              <GameButton variant="primary" onPress={handleClaim} loading={isClaiming}>
                {i18n.t('claim_chest')}
              </GameButton>
            </View>
          ) : (
            <Text style={styles.chestHint}>{i18n.t('quests_complete_hint')}</Text>
          )}
        </View>
      </AppCard>
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
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: SPACE.lg, padding: SPACE.lg },
  headingRow: { height: 30, justifyContent: 'center', marginBottom: SPACE.md },
  headingLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  heading: { marginBottom: 0 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  rune: {
    width: 28, height: 28, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.gold + '66', backgroundColor: COLORS.gold + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  runeDone: { borderColor: COLORS.bronze, backgroundColor: COLORS.panelDeep },
  runeText: { color: COLORS.gold, fontSize: FONT_SIZES.md, fontFamily: FONTS.display },
  runeTextDone: { color: COLORS.textDim },
  questInfo: { flex: 1, gap: SPACE.xs },
  questName: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.text },
  questNameDone: { color: COLORS.textDim, textDecorationLine: 'line-through' },
  questXp: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: COLORS.gold },
  pips: { flexDirection: 'row', gap: SPACE.xs },
  pip: { width: 14, height: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.panelRaised },
  pipFilled: { backgroundColor: COLORS.gold },
  chestRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md, paddingTop: SPACE.md,
    borderTopWidth: 1, borderTopColor: COLORS.bronze,
  },
  chestHint: { flex: 1, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim },
  chestBtn: { flex: 1 },
});
