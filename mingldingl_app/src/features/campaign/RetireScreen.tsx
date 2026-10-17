import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArtName } from '@/design/art/manifest';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  answerRetire,
  askRetire,
  getGetCampaignQueryKey,
  useGetBond,
  useGetCampaign,
} from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** A round painted moment over its title and line (the Encounter pages' shape). */
export function Moment({
  art,
  title,
  body,
  note,
}: {
  art: ArtName;
  title: string;
  body: string;
  note?: string;
}) {
  return (
    <View style={styles.moment}>
      <Reveal rise={0}>
        <Art name={art} style={styles.art} fit="cover" />
      </Reveal>
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
      {note ? (
        <Reveal order={3}>
          <Txt variant="labelS" color="textSecondary" align="center">
            {note.toUpperCase()}
          </Txt>
        </Reveal>
      ) : null}
    </View>
  );
}

/** You retired together (Figma 33:2199): one fire, a ger at night. */
export function RetiredTogether() {
  return (
    <Moment
      art="ger_night"
      title={t('retire.doneTitle')}
      body={t('retire.doneBody')}
      note={t('retire.honour')}
    />
  );
}

/** Retire together (Figma 33:2059 ask · 33:2129 they asked · 33:2199 done). */
export default function RetireScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const bond = useGetBond(id).data;
  const c = useGetCampaign(id).data;
  const [busy, setBusy] = useState(false);
  const name = bond?.other.name ?? '';
  const header = <RoomHeader title={t('room.encounter')} onBack={() => router.back()} />;
  const act = async (call: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const view = await call();
      client.setQueryData(getGetCampaignQueryKey(id), view);
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };
  if (!bond || !c) return <Scene header={header}>{null}</Scene>;
  if (bond.state === 'Retired')
    return (
      <Scene header={header} centered>
        <RetiredTogether />
      </Scene>
    );
  if (c.retire === 'askedByMe')
    return (
      <Scene header={header} centered>
        <StateBlock
          kind="waiting"
          title={t('retire.waitingTitle', { name })}
          body={t('retire.waitingBody')}
        />
      </Scene>
    );
  const asked = c.retire === 'askedByThem';
  return (
    <Scene
      header={header}
      centered
      footer={
        <>
          <Button
            label={asked ? t('retire.accept') : t('retire.ask', { name })}
            loading={busy}
            disabled={!asked && c.retire !== 'available'}
            onPress={() =>
              act(async () => {
                const v = asked ? await answerRetire(id, 'yes') : await askRetire(id);
                feedback(asked ? 'honourDrop' : 'press');
                return v;
              })
            }
            block
          />
          <InkLink
            label={asked ? t('retire.notNow') : t('retire.notYet')}
            onPress={() =>
              asked ? act(() => answerRetire(id, 'no')).then(() => router.back()) : router.back()
            }
          />
        </>
      }
    >
      {asked ? (
        <Moment art="fires_joined" title={t('retire.askedTitle', { name })} body={t('retire.askedBody')} />
      ) : (
        <Moment art="fires_joined" title={t('retire.title')} body={t('retire.body')} />
      )}
    </Scene>
  );
}

const styles = StyleSheet.create({
  moment: { alignItems: 'center', gap: dimension.space4 },
  art: { width: 140, height: 140, borderRadius: 70 },
});
