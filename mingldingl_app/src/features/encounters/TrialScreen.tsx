import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { CountUp } from '@/design/components/CountUp';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerTrial,
  getGetEncounterQueryKey,
  useGetBond,
  useGetEncounter,
} from '@/lib/api/generated/engine';
import type { TrialResultView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { type StringKey, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** The result's line: what they agree on, then what they differ on, from the questions' topics. */
export function trialLine(r: TrialResultView): string {
  // "a, b and c" — the comma and the "and" are the translator's
  const join = (xs: readonly string[]) =>
    xs.length < 2
      ? (xs[0] ?? '')
      : `${xs.slice(0, -1).join(t('trial.comma'))}${t('trial.and')}${xs[xs.length - 1]}`;
  return [
    r.sameTopics.length ? t('trial.agree', { topics: join(r.sameTopics) }) : null,
    r.differTopics.length ? t('trial.differ', { topics: join(r.differTopics) }) : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The Trial (Figma 31:962 a question · 31:1056 the result): five questions, four choices each, in
 * order — a choice answers at once. The result opens for both when both have finished.
 */
export default function TrialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const bond = useGetBond(id).data;
  const encounter = useGetEncounter(id).data;
  const [busy, setBusy] = useState<number | null>(null);
  const trial = encounter?.trial;
  const header = <RoomHeader title={t('room.trial')} onBack={() => router.back()} />;
  if (!trial) return <Scene header={header}>{null}</Scene>;

  const index = trial.mine.length;
  const choose = async (choice: number) => {
    setBusy(choice);
    try {
      const view = await answerTrial(id, { index, choice });
      client.setQueryData(getGetEncounterQueryKey(id), view);
      feedback(view.trial?.result ? 'rewardBurst' : 'press');
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(null);
    }
  };

  const r = trial.result;
  if (r) {
    return (
      <Scene
        header={header}
        footer={<Button label={t('common.backToLetters')} kind="plain" onPress={() => router.back()} block />}
      >
        <View style={styles.result}>
          <Reveal rise={0}>
            <CountUp
              value={r.percent}
              format={(n) => `${n}%`}
              delay={RESULT_AT}
              variant="displayXL"
              color="textAccent"
              align="center"
              accessibilityLabel={`${r.percent}%`}
            />
          </Reveal>
          <Reveal delay={RESULT_AT} order={4}>
            <Txt variant="displayM" engraved align="center" accessibilityRole="header">
              {t(`trial.kindred.${r.same}` as StringKey)}
            </Txt>
          </Reveal>
          <Reveal delay={RESULT_AT} order={6}>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {trialLine(r)}
            </Txt>
          </Reveal>
          <Reveal delay={RESULT_AT} order={8}>
            <Txt variant="labelM" color="textAccent" align="center">
              {t('trial.reward', { points: `+${encounter.rewards.trial}` }).toUpperCase()}
            </Txt>
          </Reveal>
        </View>
      </Scene>
    );
  }

  const q = trial.questions[index];
  if (!q) {
    return (
      <Scene header={header} centered>
        <StateBlock
          kind="waiting"
          title={t('trial.sealedTitle')}
          body={t('trial.sealedBody', { name: bond?.other.name ?? '' })}
        />
      </Scene>
    );
  }

  return (
    <Scene header={header}>
      {/* A new key per question: each one bleeds in fresh. */}
      <Reveal key={index} style={styles.question}>
        <Txt variant="labelM" color="textMuted">
          {t('trial.questionOf', { n: index + 1, total: trial.questions.length }).toUpperCase()}
        </Txt>
        <Txt variant="displayM" engraved accessibilityRole="header">
          {q.text}
        </Txt>
      </Reveal>
      <View style={styles.choices}>
        {q.choices.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a question's four choices never move
          <Reveal key={`${index}-${i}`} order={i + 1}>
            <ChoiceCard
              title={c}
              body={q.hints[i] ?? ''}
              selected={busy === i}
              onPress={() => busy === null && choose(i)}
            />
          </Reveal>
        ))}
      </View>
    </Scene>
  );
}

/** The score counts up once the room has travelled in. */
const RESULT_AT = 300;

const styles = StyleSheet.create({
  question: { gap: dimension.space2 },
  choices: { gap: dimension.space3 },
  result: { gap: dimension.space3, paddingTop: dimension.space7, alignItems: 'center' },
});
