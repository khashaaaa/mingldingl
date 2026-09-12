import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useDiscover, useRequestMatch } from '../../hooks/useDiscover';
import { useDailyMatchBudget } from '../../hooks/useScore';
import { CandidateCard } from '../../components/cards/CandidateCard';
import { LootToast } from '../../components/modals/LootToast';
import { AlertModal } from '../../components/modals/AlertModal';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { PanelReveal } from '../../components/modals/PanelReveal';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmberField } from '../../components/vfx/EmberField';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { RADIUS, SPACE } from '../../lib/theme';
import { StateBlock } from '../../components/ui/StateBlock';

export default function DiscoverScreen() {
  useLocaleStore((s) => s.locale);
  const [toast, setToast] = useState(false);
  const [toastPoints, setToastPoints] = useState(0);
  const [failAlert, setFailAlert] = useState<'generic' | 'dailyBudget' | 'unavailable' | null>(null);
  const { candidates, isLoading, isError, refetch, markSeen } = useDiscover();
  const { mutate: requestMatch, isPending: isRequesting } = useRequestMatch();
  const dailyBudget = useDailyMatchBudget();
  const budgetSpent = dailyBudget !== null && dailyBudget.remaining <= 0;
  const [deckSize, setDeckSize] = useState({ w: 0, h: 0 });
  const [loadingCardHeight, setLoadingCardHeight] = useState(0);

  function onDeckLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setDeckSize({ w: width, h: height });
  }

  // Matches the deck's own `cardArea` box (same padding), so the placeholder occupies exactly the
  // space `CandidateCard` will fill once it lands — the card itself is `flex: 1` with no fixed
  // height, so its box is measured, not read off a stylesheet. The header renders here too, so
  // only the card area swaps when the deck lands — the header itself never jumps into place.
  if (isLoading) return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('seek_title')} icon="sword-cross" showScore />
      <View
        style={styles.cardArea}
        onLayout={(e) => setLoadingCardHeight(e.nativeEvent.layout.height)}
      >
        {loadingCardHeight > 0 && (
          <Skeleton width="100%" height={loadingCardHeight} radius={RADIUS.md} />
        )}
      </View>
    </View>
  );

  if (isError) return (
    <View style={styles.center}>
      <StateBlock framed tone="danger" icon="wifi-off" title={i18n.t('discover_load_error')}>
        <GameButton variant="primary" onPress={() => refetch()}>{i18n.t('retry')}</GameButton>
      </StateBlock>
    </View>
  );

  const candidate = candidates?.[0];

  if (!candidate) return (
    <View style={styles.center}>
      <StateBlock
        framed
        fog
        icon="weather-night"
        title={i18n.t('empty_seek_title')}
        body={i18n.t('empty_seek_sub')}
      >
        <GameButton variant="ghost" size="compact" icon="refresh" onPress={() => refetch()}>
          {i18n.t('refresh')}
        </GameButton>
      </StateBlock>
    </View>
  );

  return (
    <View style={styles.screen}>
      <GameHeader title={i18n.t('seek_title')} icon="sword-cross" showScore />
      <View style={styles.cardArea} onLayout={onDeckLayout}>
        <PanelReveal style={{ flex: 1 }}>
          <CandidateCard
            candidate={candidate}
            requesting={isRequesting}
            requestDisabled={budgetSpent}
            onRequest={() => requestMatch(candidate, {
              onSuccess: ({ awarded }) => {
                setToastPoints(awarded);
                setToast(true);
              },
              onError: (err) => {
                const status = isAxiosError(err) ? err.response?.status : undefined;
                if (status === 409 || status === 403) {
                  markSeen(candidate.id);
                  setFailAlert('unavailable');
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
        title={i18n.t(
          failAlert === 'dailyBudget' ? 'daily_budget_title'
            : failAlert === 'unavailable' ? 'candidate_unavailable'
            : 'action_failed_title',
        )}
        message={i18n.t(
          failAlert === 'dailyBudget' ? 'daily_budget_body'
            : failAlert === 'unavailable' ? 'candidate_unavailable_body'
            : 'action_failed_body',
        )}
        onDismiss={() => setFailAlert(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  cardArea: { flex: 1, paddingHorizontal: SPACE.gutter, paddingBottom: SPACE.lg },
});
