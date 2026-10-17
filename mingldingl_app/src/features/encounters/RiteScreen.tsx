import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Flicker } from '@/design/components/Flicker';
import { Glow } from '@/design/components/Glow';
import { InkLink } from '@/design/components/InkLink';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { setFireOverride } from '@/design/world/rooms';
import { ApiError } from '@/lib/api/client';
import {
  answerRite,
  getGetEncounterQueryKey,
  proposeRite,
  useGetBond,
  useGetEncounter,
} from '@/lib/api/generated/engine';
import type { EncounterView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { when } from './NextStep';

/**
 * The Flame Rite (Figma 33:979 propose · 33:1050 they proposed · 33:1346 completed): asking for five
 * minutes face to face, answering, stepping into the call, and what it opens.
 */
export default function RiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const name = useGetBond(id).data?.other.name ?? '';
  const encounter = useGetEncounter(id).data;
  const [busy, setBusy] = useState<string | null>(null);
  const rite = encounter?.rite;
  // Figma's Rite frames burn the room's fire high (Ember, Fire=Roaring).
  useEffect(() => setFireOverride('Roaring'), []);
  const header = <RoomHeader title={t('room.rite')} onBack={() => router.back()} />;
  if (!rite) return <Scene header={header}>{null}</Scene>;

  const act = async (what: string, call: () => Promise<EncounterView>) => {
    setBusy(what);
    try {
      client.setQueryData(getGetEncounterQueryKey(id), await call());
      feedback('press');
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(null);
    }
  };

  const page = (art: 'rite_bowl' | 'rite_bowl_low', title: string, body: string, extra?: string) => (
    <View style={styles.page}>
      {/* The fire breathes; once the Rite is done only embers glow. */}
      <View style={styles.bowl}>
        <View style={styles.light}>
          <Glow tint={color.accentEmber} strength={art === 'rite_bowl' ? 0.55 : 0.3} />
        </View>
        <Flicker>
          {/* Figma fills the slot (the embers' art is wider than tall) */}
          <Art name={art} style={styles.bowl} fit="cover" />
        </Flicker>
      </View>
      <Reveal order={1}>
        <Txt variant="displayL" engraved align="center" accessibilityRole="header">
          {title}
        </Txt>
      </Reveal>
      <Reveal order={2}>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {body}
        </Txt>
      </Reveal>
      {extra ? (
        <Reveal order={3}>
          <Txt variant="labelS" color="textMuted" align="center">
            {extra.toUpperCase()}
          </Txt>
        </Reveal>
      ) : null}
    </View>
  );

  switch (rite.state) {
    case 'done':
      return (
        <Scene
          header={header}
          footer={
            <Button label={t('rite.chooseMeeting')} onPress={() => router.replace(`/meeting/${id}`)} block />
          }
        >
          {page('rite_bowl_low', t('rite.doneTitle'), t('rite.doneBody'))}
          <Reveal order={4}>
            <Txt variant="labelM" color="textAccent" align="center">
              {t('rite.reward', { points: `+${encounter.rewards.rite}` }).toUpperCase()}
            </Txt>
          </Reveal>
        </Scene>
      );
    case 'accepted':
      return (
        <Scene
          header={header}
          footer={<Button label={t('rite.enter')} onPress={() => router.push(`/call/${id}`)} block />}
        >
          {page('rite_bowl', t('rite.readyTitle'), t('rite.readyBody'), t('rite.notStored'))}
        </Scene>
      );
    case 'proposedByThem':
      return (
        <Scene
          header={header}
          footer={
            <View style={styles.footer}>
              <Button
                label={t('rite.accept')}
                onPress={() => act('accept', () => answerRite(id, { accept: true }))}
                loading={busy === 'accept'}
                block
              />
              <InkLink
                label={t('rite.notNow')}
                onPress={() => act('no', () => answerRite(id, { accept: false }))}
                disabled={busy !== null}
              />
            </View>
          }
        >
          {page('rite_bowl', t('rite.askedTitle', { name }), t('rite.askedBody'))}
        </Scene>
      );
    case 'proposedByMe':
      return (
        <Scene
          header={header}
          footer={<InkLink label={t('common.backToLetters')} onPress={() => router.back()} />}
        >
          {page('rite_bowl', t('rite.waitingTitle'), t('rite.waitingBody', { name }))}
        </Scene>
      );
    default:
      if (rite.canProposeAt)
        return (
          <Scene
            header={header}
            footer={<InkLink label={t('common.backToLetters')} onPress={() => router.back()} />}
          >
            {page(
              'rite_bowl',
              t('rite.restingTitle'),
              t('rite.restingBody', { when: when(rite.canProposeAt) }),
            )}
          </Scene>
        );
      return (
        <Scene
          header={header}
          footer={
            <View style={styles.footer}>
              <Button
                label={t('rite.propose')}
                onPress={() => act('propose', () => proposeRite(id))}
                loading={busy === 'propose'}
                block
              />
              <InkLink label={t('rite.notYet')} onPress={() => router.back()} />
            </View>
          }
        >
          {page('rite_bowl', t('rite.proposeTitle'), t('rite.proposeBody'), t('rite.notStored'))}
        </Scene>
      );
  }
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', gap: dimension.space3, paddingTop: dimension.space8 },
  bowl: { width: 140, height: 140 },
  // The light spills well past the bowl.
  light: { position: 'absolute', left: -70, right: -70, top: -70, bottom: -70 },
  footer: { alignSelf: 'stretch', alignItems: 'center', gap: dimension.space3 },
});
