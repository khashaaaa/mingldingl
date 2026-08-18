import { View, Text as RNText, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Spinner } from 'tamagui';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import { useDiscover, useRequestMatch } from '../../hooks/useDiscover';
import { useProfile } from '../../hooks/useProfile';
import { useMilestones } from '../../hooks/useMilestones';
import { CandidateCard } from '../../components/cards/CandidateCard';
import { GettingStartedCard } from '../../components/progression/GettingStartedCard';
import { LootToast } from '../../components/modals/LootToast';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { PanelReveal } from '../../components/modals/PanelReveal';
import { EmberField } from '../../components/vfx/EmberField';
import { FogDrift } from '../../components/vfx/FogDrift';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export default function DiscoverScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const router = useRouter();
  const [toast, setToast] = useState(false);
  const [toastPoints, setToastPoints] = useState(0);
  const [failAlert, setFailAlert] = useState<'generic' | 'dailyBudget' | null>(null);
  const { candidates, isLoading, isError, refetch, markSeen } = useDiscover();
  const { mutate: requestMatch, isPending: isRequesting } = useRequestMatch();
  const { data: profile } = useProfile();
  const { milestones } = useMilestones();
  const [deckSize, setDeckSize] = useState({ w: 0, h: 0 });
  const [emptySize, setEmptySize] = useState({ w: 0, h: 0 });

  function onDeckLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setDeckSize({ w: width, h: height });
  }

  function onEmptyLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setEmptySize({ w: width, h: height });
  }

  if (isLoading) return (
    <View style={styles.center}>
      <Spinner color="$gold" size="large" />
    </View>
  );

  // Checked before the generic "empty deck" branch below — without this, a
  // failed fetch (dead network, backend down) rendered the exact same "the
  // tavern is empty" copy as a genuinely-empty candidate list, with no
  // indication anything had gone wrong and no way to retry.
  if (isError) return (
    <View style={styles.center}>
      <View style={styles.emptyCard}>
        <RNText style={{ fontSize: 48 }}>📡</RNText>
        <RNText style={styles.emptyTitle}>{i18n.t('discover_load_error')}</RNText>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
      </View>
    </View>
  );

  const candidate = candidates?.[0];

  if (!candidate) return (
    <View style={styles.center}>
      <View style={styles.emptyCard} onLayout={onEmptyLayout}>
        {emptySize.w > 0 && <FogDrift width={emptySize.w} height={emptySize.h} />}
        <RNText style={{ fontSize: 48 }}>🌙</RNText>
        <RNText style={styles.emptyTitle}>{i18n.t('empty_seek_title')}</RNText>
        <RNText style={styles.emptySub}>{i18n.t('empty_seek_sub')}</RNText>
      </View>
    </View>
  );

  const achievedMilestoneIds = milestones.filter((m) => m.achievedAt).map((m) => m.id ?? '');

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('seek_title')} icon="sword-cross" showScore />
      <GettingStartedCard
        isProfileComplete={profile?.isProfileComplete ?? false}
        achievedMilestoneIds={achievedMilestoneIds}
        onCompleteProfile={() => router.push('/edit-profile')}
      />
      <View style={styles.cardArea} onLayout={onDeckLayout}>
        <PanelReveal style={{ flex: 1 }}>
          <CandidateCard
            candidate={candidate}
            requesting={isRequesting}
            onRequest={() => requestMatch(candidate, {
              onSuccess: ({ awarded }) => {
                setToastPoints(awarded);
                setToast(true);
              },
              onError: (err) => {
                const status = isAxiosError(err) ? err.response?.status : undefined;
                if (status === 409 || status === 403) {
                  // Already matched or blocked — this candidate can never
                  // succeed on retry, so resolve it the same way a
                  // successful request would (drop from the deck) instead
                  // of showing a "try again" alert that can never help.
                  markSeen(candidate.id);
                } else if (status === 400) {
                  setFailAlert('dailyBudget');
                } else {
                  setFailAlert('generic');
                }
              },
            })}
            onSkip={() => markSeen(candidate.id)}
          />
        </PanelReveal>
        {deckSize.w > 0 && <EmberField width={deckSize.w} height={deckSize.h} density={8} />}
      </View>
      <LootToast
        title={i18n.t('match_requested')}
        points={toastPoints}
        visible={toast}
        onDismiss={() => setToast(false)}
        bottomOffset={68}
      />
      <AlertModal
        visible={failAlert !== null}
        tone="warning"
        title={i18n.t(failAlert === 'dailyBudget' ? 'daily_budget_title' : 'action_failed_title')}
        message={i18n.t(failAlert === 'dailyBudget' ? 'daily_budget_body' : 'action_failed_body')}
        onDismiss={() => setFailAlert(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  cardArea: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.display, color: COLORS.text },
  emptySub: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textDim, textAlign: 'center' },
});
