import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { useGetVenue } from '@/lib/api/generated/engine';
import { t, tCount, tVenue } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { eyebrow } from './MeetingScreen';

/**
 * The Venue (Figma 33:1635 detail · 33:1701 gone): the place, its stars from kept meetings, what it
 * is like and where. Opened while choosing, it offers "Meet here".
 */
export default function VenueScreen() {
  const { id, bond } = useLocalSearchParams<{ id: string; bond?: string }>();
  const v = useGetVenue(id).data;
  const header = <RoomHeader title={t('room.venue')} onBack={() => router.back()} />;
  if (!v) return <Scene header={header}>{null}</Scene>;

  if (v.gone)
    return (
      <Scene
        header={header}
        centered
        footer={<Button label={t('venue.chooseAnother')} kind="plain" onPress={() => router.back()} block />}
      >
        <View style={styles.gonePage}>
          <Art name="venue_gone" style={styles.gone} fit="contain" />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('venue.goneTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('venue.goneBody')}
          </Txt>
        </View>
      </Scene>
    );

  const photo = v.photos[0];
  const rating =
    v.rating == null
      ? t('venue.noRatings')
      : `★ ${v.rating.toFixed(1)}  ·  ${tCount('venue.ratings', v.ratings)}`;
  const where = [v.address, v.hours ? t('venue.hours', { hours: v.hours }) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Scene
      header={header}
      footer={
        bond ? (
          <Button
            label={t('venue.meetHere')}
            onPress={() => router.replace(`/meeting/${bond}?venue=${v.id}`)}
            block
          />
        ) : undefined
      }
    >
      {/* A venue the keepers have not photographed yet shows no empty frame. */}
      {photo ? (
        <View style={styles.photo}>
          <Image
            source={{ uri: photo.url, cacheKey: photo.id }}
            placeholder={{ thumbhash: photo.thumbHash }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}
      <View style={styles.text}>
        <Txt variant="labelS" color="textMuted">
          {eyebrow(v).toUpperCase()}
        </Txt>
        <Txt variant="displayL" accessibilityRole="header">
          {tVenue(v)}
        </Txt>
        <Txt variant="bodyS" color="textAccent">
          {rating}
        </Txt>
      </View>
      {v.description ? <Txt variant="bodyM">{v.description}</Txt> : null}
      <Txt variant="bodyS" color="textSecondary">
        {where}
      </Txt>
    </Scene>
  );
}

const styles = StyleSheet.create({
  photo: { height: 220, marginHorizontal: -dimension.sizeGutter, backgroundColor: color.bgPanel },
  text: { gap: dimension.space1 },
  gonePage: { alignItems: 'center', gap: dimension.space3 },
  gone: { width: 220, height: 180 },
});
