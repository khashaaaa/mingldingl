import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { SectionLabel } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { CANDLELIT_PAD, Candlelit } from '@/design/components/Candlelit';
import { asTier, GemBadge } from '@/design/components/GemBadge';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { useGetChests, useGetMe, useGetQuests, useListMyPhotos } from '@/lib/api/generated/engine';
import { t, tCount, tValue } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { moonLine } from '../common/time';
import { questTitle } from './quests';

/** The Satchel (Figma 28:743): your oath, the chests waiting to be opened, your keepsake. */
export function Satchel() {
  const profile = useGetMe().data?.profile;
  const chests = useGetChests().data ?? [];
  const dawns = useGetQuests().data?.dawns ?? 0;
  if (!profile) return null;
  const sworn = profile.oathSwornAt;
  return (
    <Scene header={<RoomHeader title={t('room.satchel')} onBack={() => router.back()} />}>
      <View style={styles.list}>
        {profile.oath ? (
          <>
            <SectionLabel text={t('satchel.oath')} />
            <Row
              glyph="pledge"
              title={tValue('oath', profile.oath)}
              subtitle={
                sworn
                  ? profile.oathProvenAt
                    ? moonLine('satchel.provenBy', sworn)
                    : moonLine('satchel.sworn', sworn)
                  : undefined
              }
              meta={t(profile.oathProvenAt ? 'satchel.proven' : 'satchel.swornMeta').toUpperCase()}
            />
          </>
        ) : null}
        {chests.length > 0 ? (
          <>
            <SectionLabel text={t('satchel.chests')} />
            {chests.map((c) => (
              <Row
                key={c.id}
                glyph="chest"
                title={t('satchel.chest')}
                subtitle={t('satchel.chestFrom', { quest: t(questTitle(c.fromQuest)) })}
                meta={t('satchel.open').toUpperCase()}
                onPress={() => router.push(`/ceremony/chest/${c.id}`)}
              />
            ))}
          </>
        ) : null}
        <SectionLabel text={t('satchel.keepsakes')} />
        <Row
          glyph="gem"
          title={t('satchel.card')}
          subtitle={tCount('satchel.dawns', Math.max(1, dawns))}
          meta={t('satchel.share').toUpperCase()}
          onPress={() => router.push('/keepsake')}
        />
      </View>
    </Scene>
  );
}

/** Share character (Figma 28:1019): the card inside its gold line as a picture, sent through the phone's share sheet. */
export function Keepsake() {
  const profile = useGetMe().data?.profile;
  const photo = useListMyPhotos().data?.[0] ?? null;
  const dawns = useGetQuests().data?.dawns ?? 0;
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        toast('error', t('keepsake.unavailable'));
        return;
      }
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      toast('error', t('keepsake.shareFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Scene header={<RoomHeader title={t('room.satchel')} onBack={() => router.back()} />}>
      <View ref={card} collapsable={false} style={styles.card}>
        <Candlelit fill={color.bgPanel} />
        <AvatarFrame state="mine" photo={photo} label={profile.name} size={115} />
        <Txt variant="displayL" align="center">
          {profile.name}
        </Txt>
        <GemBadge tier={asTier(profile.tier)} size={56} />
        <Txt variant="voiceM" color="textAccent" align="center">
          {tCount('keepsake.dawns', Math.max(1, dawns))}
        </Txt>
        <Txt variant="labelS" color="textMuted" align="center">
          {t('app.name').toUpperCase()}
        </Txt>
      </View>
      <View style={styles.foot}>
        <Txt variant="labelM" color="textSecondary">
          {t('keepsake.label').toUpperCase()}
        </Txt>
        <Button label={t('satchel.share')} onPress={share} disabled={busy} />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  list: { marginHorizontal: -dimension.sizeGutter },
  // the character card inside the gold line, as the Square's bell
  card: { alignItems: 'center', gap: 10, padding: CANDLELIT_PAD },
  foot: { alignItems: 'center', gap: dimension.space4 },
});
