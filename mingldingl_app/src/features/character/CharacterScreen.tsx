import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { Banner } from '@/design/components/Banner';
import { asTier, GemBadge } from '@/design/components/GemBadge';
import { InkLink } from '@/design/components/InkLink';
import { NameTitle } from '@/design/components/NameTitle';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { XpBar } from '@/design/components/XpBar';
import { dimension } from '@/design/tokens';
import {
  useGetChests,
  useGetEncounterLog,
  useGetHonours,
  useGetMe,
  useGetTiers,
  useListMyPhotos,
} from '@/lib/api/generated/engine';
import { t, tCount, tValue } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { standing } from '../score/ladder';
import { daysLeft, keep } from '../settings/Departing';
import { toHearth } from '../world/home';

/**
 * Your own character sheet: first portrait, name, gem, points and the oath you swore. Every
 * value is read from the cache, so a `profile.updated` or `photos.updated` event redraws it.
 * The bar measures the way to the next gem on the engine's ladder.
 */
export default function CharacterScreen() {
  const me = useGetMe().data;
  const photos = useListMyPhotos().data;
  const ladder = useGetTiers().data;
  const honours = useGetHonours().data;
  const chests = useGetChests().data?.length ?? 0;
  const charted = useGetEncounterLog().data?.standing.districts.length ?? 0;
  const earned = honours?.filter((h) => h.earned).length ?? 0;
  const profile = me?.profile;
  if (!profile) return null;
  const { progress, next } = standing(profile.points, ladder);
  const nameAge = t('character.nameAge', { name: profile.name, age: profile.age });

  return (
    <Scene
      tabbed
      header={
        <RoomHeader
          title={t('room.character')}
          onBack={toHearth}
          action={{
            glyph: 'more',
            label: t('room.warRoom'),
            onPress: () => router.push('/war-room'),
          }}
        />
      }
    >
      {me.deleteAt ? (
        // Figma 35:1187: the character is fading; keeping it is one tap away.
        <View style={styles.fading}>
          <Banner text={t('departing.banner', { days: daysLeft(me.deleteAt) })} />
          <InkLink align="start" label={t('abandon.keep')} onPress={keep} />
        </View>
      ) : null}
      <View style={styles.hero}>
        <AvatarFrame state="mine" photo={photos?.[0] ?? null} label={nameAge} size={115} />
        <NameTitle name={profile.name} text={nameAge} />
        <GemBadge tier={asTier(profile.tier)} size={40} alive />
      </View>
      <XpBar points={profile.points} progress={progress} next={next} />
      <View style={styles.rows}>
        {profile.oath ? (
          <Row
            title={t('character.oath')}
            subtitle={t(profile.oathProvenAt ? 'character.oathProven' : 'character.oathSworn', {
              oath: tValue('oath', profile.oath),
            })}
            meta={t(profile.oathProvenAt ? 'satchel.proven' : 'satchel.swornMeta').toUpperCase()}
          />
        ) : null}
        <Row
          title={t('character.honours')}
          subtitle={t('character.honoursHint', { n: earned, total: honours?.length ?? 21 })}
          meta={String(earned)}
          onPress={() => router.push('/honours')}
        />
        <Row
          title={t('character.satchel')}
          subtitle={t('character.satchelHint')}
          meta={String((profile.oath ? 1 : 0) + chests + 1)}
          onPress={() => router.push('/satchel')}
        />
        <Row
          title={t('character.encounterLog')}
          subtitle={charted > 0 ? tCount('character.logHint', charted) : t('character.logHintNone')}
          meta={charted > 0 ? String(charted) : undefined}
          onPress={() => router.push('/encounter-log')}
        />
        <Row
          title={t('character.threads')}
          subtitle={t('character.threadsHint')}
          onPress={() => router.push('/thread-log')}
        />
        <Row
          title={t('character.allies')}
          subtitle={t('character.alliesHint')}
          onPress={() => router.push('/allies')}
        />
        <Row
          title={t('character.ascent')}
          subtitle={t('character.ascentHint')}
          onPress={() => router.push('/ascent')}
        />
        <Row
          title={t('character.chronicle')}
          subtitle={t('character.chronicleHint')}
          onPress={() => router.push('/deeds')}
        />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: dimension.space3 },
  fading: { alignItems: 'flex-start' },
  // Rows run edge to edge, past the Scene's gutter.
  rows: { marginHorizontal: -dimension.sizeGutter },
});
