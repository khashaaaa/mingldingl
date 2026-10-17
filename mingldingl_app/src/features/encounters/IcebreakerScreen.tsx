import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { Letter } from '@/design/components/Letter';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { TextArea } from '@/design/components/TextArea';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerIcebreaker,
  getGetEncounterQueryKey,
  useGetBond,
  useGetEncounter,
} from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

const MAX = 300;

/**
 * Icebreaker (Figma 31:755 answer · 31:827 waiting · 31:892 revealed): one question for both, each
 * answer sealed until the other's arrives; a live event opens them together.
 */
export default function IcebreakerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const bond = useGetBond(id).data;
  const encounter = useGetEncounter(id).data;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ice = encounter?.icebreaker;
  const name = bond?.other.name ?? '';
  const header = <RoomHeader title={t('room.icebreaker')} onBack={() => router.back()} />;
  if (!ice) return <Scene header={header}>{null}</Scene>;

  const seal = async () => {
    setBusy(true);
    try {
      const view = await answerIcebreaker(id, { text: text.trim() });
      client.setQueryData(getGetEncounterQueryKey(id), view);
      feedback(view.icebreaker?.revealed ? 'rewardBurst' : 'press');
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (ice.revealed) {
    return (
      <Scene
        header={header}
        footer={<Button label={t('common.backToLetters')} kind="plain" onPress={() => router.back()} block />}
      >
        <Txt variant="displayS" accessibilityRole="header">
          {ice.question}
        </Txt>
        <View style={styles.answers}>
          {/* Theirs bleeds in first: it is what was sealed until now. */}
          <Reveal>
            <Letter label={name} text={ice.theirs ?? ''} mine={false} block />
          </Reveal>
          <Reveal order={2}>
            <Letter label={t('icebreaker.you')} text={ice.mine ?? ''} mine block />
          </Reveal>
        </View>
        <Reveal order={5}>
          <Txt variant="voiceM" color="textAccent">
            {t(encounter?.rite ? 'icebreaker.reward' : 'icebreaker.rewardNoRite', {
              points: `+${encounter?.rewards.icebreaker ?? 0}`,
            })}
          </Txt>
        </Reveal>
      </Scene>
    );
  }

  if (ice.mine) {
    return (
      <Scene header={header} centered>
        <StateBlock
          kind="waiting"
          title={t('icebreaker.sealedTitle')}
          body={t('icebreaker.sealedBody', { name })}
        />
      </Scene>
    );
  }

  return (
    <Scene
      header={header}
      footer={
        <Button
          label={t('icebreaker.seal')}
          onPress={seal}
          disabled={text.trim().length === 0}
          loading={busy}
          block
        />
      }
    >
      <View style={styles.question}>
        <Txt variant="labelM" color="textMuted">
          {t('icebreaker.lede').toUpperCase()}
        </Txt>
        <Txt variant="displayM" engraved accessibilityRole="header">
          {ice.question}
        </Txt>
      </View>
      <TextArea label={t('icebreaker.yourAnswer')} value={text} onChangeText={setText} maxLength={MAX} />
      <Txt variant="voiceM" color="textSecondary">
        {t('icebreaker.hint', { name })}
      </Txt>
    </Scene>
  );
}

const styles = StyleSheet.create({
  question: { gap: dimension.space2 },
  answers: { gap: dimension.space4 },
});
