import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Letter } from '@/design/components/Letter';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { TextArea } from '@/design/components/TextArea';
import { Txt } from '@/design/components/Txt';
import { VenueCard } from '@/design/components/VenueCard';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerWandering,
  askWandering,
  getGetWanderingQueryKey,
  getGetWanderingsQueryKey,
  useGetBond,
  useGetWandering,
  writeWanderingLine,
} from '@/lib/api/generated/engine';
import type { WanderingView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError, tVenue } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { eyebrow } from '../encounters/MeetingScreen';

const MAX = 300;
const FELLOW = 3;

/**
 * One Wandering (Figma 260:3019 open · 262:3051 asked of you · 262:3138 your line · 262:3214 kept):
 * what you do and where, the verified places that suit it, and the ask. Once agreed, each writes
 * what they will remember; the lines open together. No points, nothing lost.
 */
export default function WanderingScreen() {
  const { id, key } = useLocalSearchParams<{ id: string; key: string }>();
  const client = useQueryClient();
  const w = useGetWandering(id, key).data;
  const name = useGetBond(id).data?.other.name ?? '';
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const header = <RoomHeader title={t('room.wanderings')} onBack={() => router.back()} />;
  if (!w) return <Scene header={header}>{null}</Scene>;

  const act = async (call: () => Promise<WanderingView>, feel: 'press' | 'rewardBurst' = 'press') => {
    setBusy(true);
    try {
      const view = await call();
      client.setQueryData(getGetWanderingQueryKey(id, key), view);
      client.invalidateQueries({ queryKey: getGetWanderingsQueryKey(id) });
      feedback(view.state === 'kept' ? 'rewardBurst' : feel);
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (w.state === 'kept')
    return (
      <Scene
        header={header}
        footer={<Button label={t('common.backToLetters')} kind="plain" onPress={() => router.back()} block />}
      >
        <Txt variant="displayS" accessibilityRole="header">
          {w.title}
        </Txt>
        <View style={styles.lines}>
          <Reveal>
            <Letter label={name} text={w.theirLine ?? ''} mine={false} block />
          </Reveal>
          <Reveal order={2}>
            <Letter label={t('icebreaker.you')} text={w.myLine ?? ''} mine block />
          </Reveal>
        </View>
        <Reveal order={5}>
          <Txt variant="voiceM" color="textAccent">
            {w.fellow >= FELLOW ? t('wander.keptFellow') : t('wander.kept', { n: w.fellow, of: FELLOW })}
          </Txt>
        </Reveal>
      </Scene>
    );

  if (w.state === 'going' && w.myLine)
    return (
      <Scene header={header} centered>
        <StateBlock
          kind="waiting"
          title={t('wander.lineSealedTitle')}
          body={t('wander.lineSealedBody', { name })}
        />
      </Scene>
    );

  if (w.state === 'going')
    return (
      <Scene
        header={header}
        footer={
          <Button
            label={t('wander.sealLine')}
            onPress={() => act(() => writeWanderingLine(id, key, { text: text.trim() }))}
            disabled={text.trim().length === 0}
            loading={busy}
            block
          />
        }
      >
        <View style={styles.question}>
          <Txt variant="labelM" color="textMuted">
            {t('wander.after', { title: w.title }).toUpperCase()}
          </Txt>
          <Txt variant="displayM" engraved accessibilityRole="header">
            {t('wander.remember')}
          </Txt>
        </View>
        <TextArea label={t('wander.yourLine')} value={text} onChangeText={setText} maxLength={MAX} />
        <Txt variant="voiceM" color="textSecondary">
          {t('wander.lineHint', { name })}
        </Txt>
      </Scene>
    );

  const footer =
    w.state === 'askedOfMe' ? (
      <View style={styles.footer}>
        <Button
          label={t('wander.yes')}
          onPress={() => act(() => answerWandering(id, key, 'yes'))}
          loading={busy}
          block
        />
        <InkLink label={t('wander.no')} onPress={() => act(() => answerWandering(id, key, 'no'))} />
      </View>
    ) : w.state === 'open' ? (
      <View style={styles.footer}>
        <Button
          label={t('wander.ask', { name })}
          onPress={() => act(() => askWandering(id, key))}
          loading={busy}
          block
        />
        <InkLink label={t('wander.swear')} onPress={() => router.push(`/meeting/${id}` as never)} />
      </View>
    ) : undefined;

  return (
    <Scene header={header} footer={footer}>
      <Txt variant="displayS" accessibilityRole="header">
        {w.title}
      </Txt>
      {w.state === 'askedOfMe' ? (
        <Banner glyph="map" tint="textSecondary" text={t('wander.askedOfMe', { name, title: w.title })} />
      ) : null}
      {w.state === 'asked' ? (
        <Banner glyph="map" tint="textSecondary" text={t('wander.asked', { name })} />
      ) : null}
      {w.state === 'sealed' ? (
        <Banner clasp text={w.road === 'trusted' ? t('wander.sealedTrusted') : t('wander.sealedFirst')} />
      ) : null}
      <Txt variant="voiceM">{w.body}</Txt>
      <Letter label={t('wander.where')} text={w.where} mine block />
      {/* With places to offer, the roads list already said it (Figma 260:3019 · 262:3051). */}
      {w.state === 'open' && w.venues.length > 0 ? null : (
        <Txt variant="voiceM" color="textAccent">
          {t('wander.offrail')}
        </Txt>
      )}
      {w.state === 'open'
        ? w.venues.map((v) => (
            <VenueCard
              key={v.id}
              photo={v.photos[0] ?? null}
              eyebrow={eyebrow(v)}
              name={tVenue(v)}
              meta={t('meeting.verified')}
              onPress={() => router.push(`/venue/${v.id}?bond=${id}`)}
            />
          ))
        : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  question: { gap: dimension.space2 },
  lines: { gap: dimension.space4 },
  footer: { gap: dimension.space3, alignItems: 'center', alignSelf: 'stretch' },
});
