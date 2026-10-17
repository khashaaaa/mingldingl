import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { Letter } from '@/design/components/Letter';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { StateBlock } from '@/design/components/StateBlock';
import { TextArea } from '@/design/components/TextArea';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerWeeklyTrial,
  getGetWeeklyTrialQueryKey,
  openSpeedGame,
  useGetBond,
  useGetWeeklyTrial,
} from '@/lib/api/generated/engine';
import type { GameView, WeeklyAnswerRequest, WeeklyTrialView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { clock } from '../common/time';

const MAX = 300;
const GAME_TITLE = ['games.strength', 'games.aim', 'games.speed'] as const;
const GAME_ART = ['game_wrestling', 'game_archery', 'game_horse'] as const;

/**
 * The week's trial (Figma 33:1991 the Exchange · 47:1112 the Three Games): an intro, then each game
 * answered privately and opened to both once both have answered; `trial.updated` redraws it live.
 */
export default function WeeklyTrialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const trial = useGetWeeklyTrial(id).data;
  const name = useGetBond(id).data?.other.name ?? '';
  const [entered, setEntered] = useState(false);
  const [game, setGame] = useState<number | null>(null);
  const header = (
    <RoomHeader title={t('room.trial')} onBack={() => (game !== null ? setGame(null) : router.back())} />
  );
  if (trial === undefined) return <Scene header={header}>{null}</Scene>;
  if (!trial)
    return (
      <Scene header={header} centered>
        <StateBlock kind="empty" title={t('weekly.lapsed')} body={t('weekly.sealedBody', { name })} />
      </Scene>
    );

  const save = (v: WeeklyTrialView) => client.setQueryData(getGetWeeklyTrialQueryKey(id), v);
  const answer = async (g: number, req: WeeklyAnswerRequest) => {
    try {
      const v = await answerWeeklyTrial(id, g, req);
      save(v);
      feedback(v.games[g]?.paid ? 'rewardBurst' : 'press');
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    }
  };
  const games = trial.kind === 'threeGames';
  const started = trial.games.some((g) => g.answered || g.openedAt);

  if (!entered && !started)
    return (
      <Scene
        header={header}
        footer={
          <Button label={t(games ? 'games.enter' : 'weekly.take')} onPress={() => setEntered(true)} block />
        }
      >
        <Intro trial={trial} />
      </Scene>
    );

  if (!games) {
    const g = trial.games[0];
    return g ? (
      <Exchange
        header={header}
        g={g}
        name={name}
        points={trial.points}
        onAnswer={(text) => answer(0, { text, choice: null, guess: null })}
      />
    ) : null;
  }

  const open = game !== null ? trial.games[game] : undefined;
  if (open)
    return (
      <Game
        header={header}
        g={open}
        name={name}
        onAnswer={(req) => answer(open.game, req)}
        onClose={() => setGame(null)}
        onOpen={async () => {
          try {
            save(await openSpeedGame(id));
          } catch {
            toast('error', t('error.generic'));
          }
        }}
      />
    );
  return (
    <Scene header={header}>
      <Intro trial={trial} />
      <View style={styles.rows}>
        {trial.games.map((g) => (
          <Row
            key={g.game}
            title={t(GAME_TITLE[g.game] ?? 'games.strength')}
            subtitle={
              g.answered ? (g.theyAnswered ? t('games.done') : t('games.waiting', { name })) : t('games.play')
            }
            meta={g.paid ? `+${trial.points}` : undefined}
            onPress={() => setGame(g.game)}
          />
        ))}
      </View>
    </Scene>
  );
}

function Intro({ trial }: { trial: WeeklyTrialView }) {
  const games = trial.kind === 'threeGames';
  return (
    <View style={styles.intro}>
      {games ? (
        <View style={styles.figures}>
          {GAME_ART.map((a) => (
            <Art key={a} name={a} style={styles.figure} fit="contain" />
          ))}
        </View>
      ) : (
        <Art name="trial_tokens" style={styles.tokens} fit="cover" />
      )}
      <Txt variant="displayL" engraved align="center" accessibilityRole="header">
        {t(games ? 'games.title' : 'weekly.title')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary" align="center">
        {games ? t('games.body') : t('weekly.body', { prompt: trial.games[0]?.prompt ?? '' })}
      </Txt>
      <Txt variant="labelM" color="textAccent" align="center">
        {t(games ? 'games.reward' : 'weekly.reward', { points: trial.points }).toUpperCase()}
      </Txt>
    </View>
  );
}

/** The Exchange: one prompt, a sealed answer, both opened together. */
function Exchange({
  header,
  g,
  name,
  points,
  onAnswer,
}: {
  header: React.ReactNode;
  g: GameView;
  name: string;
  points: number;
  onAnswer: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (g.answered && g.theirText !== null)
    return (
      <Scene
        header={header}
        footer={<Button kind="plain" label={t('common.backToLetters')} onPress={() => router.back()} block />}
      >
        <Txt variant="displayS" accessibilityRole="header">
          {g.prompt}
        </Txt>
        <View style={styles.answers}>
          <Reveal>
            <Letter label={name} text={g.theirText} mine={false} block />
          </Reveal>
          <Reveal order={2}>
            <Letter label={t('weekly.you')} text={g.myText ?? ''} mine block />
          </Reveal>
        </View>
        <Reveal order={5}>
          <Txt variant="voiceM" color="textAccent">
            {t('weekly.earned', { points })}
          </Txt>
        </Reveal>
      </Scene>
    );
  if (g.answered)
    return (
      <Scene header={header} centered>
        <StateBlock kind="waiting" title={t('weekly.sealedTitle')} body={t('weekly.sealedBody', { name })} />
      </Scene>
    );
  return (
    <Scene
      header={header}
      footer={
        <Button
          label={t('weekly.seal')}
          disabled={text.trim().length === 0}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await onAnswer(text.trim());
            setBusy(false);
          }}
          block
        />
      }
    >
      <Txt variant="displayM" engraved accessibilityRole="header">
        {g.prompt}
      </Txt>
      <TextArea label={t('weekly.yourAnswer')} value={text} onChangeText={setText} maxLength={MAX} />
      <Txt variant="voiceM" color="textSecondary">
        {t('weekly.hint', { name })}
      </Txt>
    </Scene>
  );
}

/** One of the Three Games: strength (who gives way), aim (yours and your guess), speed (within the hour). */
function Game({
  header,
  g,
  name,
  onAnswer,
  onOpen,
  onClose,
}: {
  header: React.ReactNode;
  g: GameView;
  name: string;
  onAnswer: (req: WeeklyAnswerRequest) => Promise<void>;
  onOpen: () => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (req: WeeklyAnswerRequest) => {
    setBusy(true);
    await onAnswer(req);
    setBusy(false);
  };
  const both = g.answered && g.theyAnswered;
  const back = <Button kind="plain" label={t('common.back')} onPress={onClose} block />;

  if (g.kind === 'strength') {
    const picks = [
      { title: t('games.iDo'), body: t('games.iDoHint') },
      { title: t('games.theyDo'), body: t('games.theyDoHint', { name }) },
    ];
    if (both)
      return (
        <Scene header={header} footer={back}>
          <Txt variant="displayM" engraved accessibilityRole="header">
            {t('games.strengthQuestion')}
          </Txt>
          <Txt variant="labelM" color="textMuted">
            {t('games.youChose').toUpperCase()}
          </Txt>
          <Txt variant="displayS">{picks[g.myChoice ?? 0]?.title}</Txt>
          <Txt variant="labelM" color="textMuted">
            {t('games.theyChose', { name }).toUpperCase()}
          </Txt>
          <Txt variant="displayS">{picks[g.theirChoice ?? 0]?.title}</Txt>
        </Scene>
      );
    if (g.answered) return <Waiting header={header} name={name} />;
    return (
      <Scene
        header={header}
        footer={
          <Button
            label={t('weekly.seal')}
            disabled={choice === null}
            loading={busy}
            onPress={() => send({ text: null, choice, guess: null })}
            block
          />
        }
      >
        <Txt variant="displayM" engraved accessibilityRole="header">
          {t('games.strengthQuestion')}
        </Txt>
        {picks.map((p, i) => (
          <ChoiceCard
            key={p.title}
            glyph={i === 0 ? 'bow' : 'swords'}
            title={p.title}
            body={p.body}
            selected={choice === i}
            onPress={() => setChoice(i)}
          />
        ))}
      </Scene>
    );
  }

  if (g.kind === 'aim') {
    const choices = g.choices ?? [];
    if (both)
      return (
        <Scene header={header} footer={back}>
          <Txt variant="displayM" engraved accessibilityRole="header">
            {g.prompt}
          </Txt>
          <Txt variant="voiceM" color="textAccent">
            {t(g.myGuess === g.theirChoice ? 'games.aimHit' : 'games.aimMiss')}
          </Txt>
          <Txt variant="labelM" color="textMuted">
            {t('games.theyChose', { name }).toUpperCase()}
          </Txt>
          <Txt variant="displayS">{choices[g.theirChoice ?? 0]}</Txt>
          <Txt variant="labelM" color="textMuted">
            {t('games.youChose').toUpperCase()}
          </Txt>
          <Txt variant="displayS">{choices[g.myChoice ?? 0]}</Txt>
        </Scene>
      );
    if (g.answered) return <Waiting header={header} name={name} />;
    return (
      <Scene
        header={header}
        footer={
          <Button
            label={t('weekly.seal')}
            disabled={choice === null || guess === null}
            loading={busy}
            onPress={() => send({ text: null, choice, guess })}
            block
          />
        }
      >
        <Txt variant="displayM" engraved accessibilityRole="header">
          {g.prompt}
        </Txt>
        <Txt variant="labelM" color="textMuted">
          {t('games.aimMine').toUpperCase()}
        </Txt>
        {choices.map((c, i) => (
          <ChoiceCard
            key={`m${c}`}
            glyph="target"
            title={c}
            body=""
            selected={choice === i}
            onPress={() => setChoice(i)}
          />
        ))}
        <Txt variant="labelM" color="textMuted">
          {t('games.aimGuess').toUpperCase()}
        </Txt>
        {choices.map((c, i) => (
          <ChoiceCard
            key={`g${c}`}
            glyph="eye"
            title={c}
            body=""
            selected={guess === i}
            onPress={() => setGuess(i)}
          />
        ))}
      </Scene>
    );
  }

  // Speed: the prompt stays closed until opened; then an hour runs.
  if (both)
    return (
      <Scene header={header} footer={back}>
        <Txt variant="displayS" accessibilityRole="header">
          {g.prompt}
        </Txt>
        <Letter label={name} text={g.theirText ?? ''} mine={false} block />
        <Letter label={t('weekly.you')} text={g.myText ?? ''} mine block />
        {!g.paid ? (
          <Txt variant="voiceM" color="textSecondary">
            {t('games.speedLate')}
          </Txt>
        ) : null}
      </Scene>
    );
  if (g.answered) return <Waiting header={header} name={name} />;
  if (!g.openedAt)
    return (
      <Scene header={header} centered footer={<Button label={t('games.speedOpen')} onPress={onOpen} block />}>
        <Art name="game_horse" style={styles.figureBig} fit="contain" />
        <Txt variant="voiceM" color="textSecondary" align="center">
          {t('games.speedHint')}
        </Txt>
      </Scene>
    );
  return (
    <Scene
      header={header}
      footer={
        <Button
          label={t('weekly.seal')}
          disabled={text.trim().length === 0}
          loading={busy}
          onPress={() => send({ text: text.trim(), choice: null, guess: null })}
          block
        />
      }
    >
      <Txt variant="displayM" engraved accessibilityRole="header">
        {g.prompt}
      </Txt>
      {g.due ? (
        <Txt variant="labelM" color="textAccent">
          {t('games.speedDue', { time: clock(g.due) }).toUpperCase()}
        </Txt>
      ) : null}
      <TextArea label={t('weekly.yourAnswer')} value={text} onChangeText={setText} maxLength={MAX} />
    </Scene>
  );
}

function Waiting({ header, name }: { header: React.ReactNode; name: string }) {
  return (
    <Scene header={header} centered>
      <StateBlock kind="waiting" title={t('weekly.sealedTitle')} body={t('games.waiting', { name })} />
    </Scene>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space6 },
  tokens: { width: 140, height: 140, borderRadius: 70 },
  figures: { flexDirection: 'row', gap: dimension.space3 },
  figure: { width: 96, height: 96 },
  figureBig: { width: 120, height: 120 },
  answers: { gap: dimension.space4 },
  rows: { marginHorizontal: -dimension.sizeGutter },
});
