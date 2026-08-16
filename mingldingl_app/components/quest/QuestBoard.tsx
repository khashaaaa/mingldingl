import { useState } from 'react';
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
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

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
  // Separate from `chest` itself: ChestModal wraps RN's own <Modal
  // animationType="fade">, which needs to stay mounted with visible
  // toggling false→true to play its own dismiss transition. Unmounting it
  // outright the instant the chest is dismissed (the old `{chest && ...}`
  // pattern) tears the whole thing down mid-animation instead.
  const [chestVisible, setChestVisible] = useState(false);
  const [headingWidth, setHeadingWidth] = useState(0);
  const [failAlert, setFailAlert] = useState(false);

  if (isLoading || !board) return null;

  // During a festival window (Naadam, Tsagaan Sar — see lib/festivals.ts),
  // the board keeps its exact quest logic/targets and just swaps heading
  // icon/copy/accent color for the occasion. accent falls back to the
  // regular gold tint the rest of the year.
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
        // bumpScore may have just set pendingTierUp, which GameHeader shows
        // as a LootToast that starts its own auto-dismiss timer immediately
        // — even while fully hidden behind this chest modal. Stash it and
        // re-set it only once the modal closes, so it can't time out unseen
        // while the user is still admiring the chest reward.
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
            <Icon name={headingIcon} size={16} color={accent} />
            <Text style={[styles.heading, { color: accent }]}>{headingText.toUpperCase()}</Text>
          </View>
          {headingWidth > 0 && <EmberField width={headingWidth} height={30} density={4} />}
        </View>
        {board.quests?.map((q) => (
          <View key={q.questId} style={styles.questRow}>
            <View style={[styles.rune, !q.completed && { borderColor: accent + '66', backgroundColor: accent + '15' }, q.completed && styles.runeDone]}>
              {q.completed ? (
                <Text style={[styles.runeText, styles.runeTextDone]}>✓</Text>
              ) : (
                <Icon name="sword-cross" size={13} color={accent} />
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
            size={22}
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
  card: { marginBottom: 14, padding: 16 },
  headingRow: { height: 30, justifyContent: 'center', marginBottom: 10 },
  headingLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.gold, letterSpacing: 2 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rune: {
    width: 28, height: 28, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.gold + '66', backgroundColor: COLORS.gold + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  runeDone: { borderColor: COLORS.bronze, backgroundColor: COLORS.panelDeep },
  runeText: { color: COLORS.gold, fontSize: 13, fontFamily: FONTS.display },
  runeTextDone: { color: COLORS.textDim },
  questInfo: { flex: 1, gap: 4 },
  questName: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
  questNameDone: { color: COLORS.textDim, textDecorationLine: 'line-through' },
  questXp: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.gold },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 4, borderRadius: 2, backgroundColor: COLORS.panelRaised },
  pipFilled: { backgroundColor: COLORS.gold },
  chestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.bronze,
  },
  chestHint: { flex: 1, fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim },
  chestBtn: { flex: 1 },
});
