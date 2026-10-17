import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, dimension } from '../tokens';
import { Txt } from './Txt';

export type VenuePhoto = { id: string; url: string; thumbHash: string };

/**
 * Figma Venue Card (30:107): the place's photo over its kind and district, its name, and a gold
 * line under it (the rating, or the day and hour of a meeting there).
 */
export function VenueCard({
  photo,
  eyebrow,
  name,
  meta,
  onPress,
}: {
  photo: VenuePhoto | null;
  eyebrow: string;
  name: string;
  meta: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}. ${eyebrow}. ${meta}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.photo}>
        {photo ? (
          <Image
            source={{ uri: photo.url, cacheKey: photo.id }}
            placeholder={{ thumbhash: photo.thumbHash }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      <View style={styles.text}>
        <Txt variant="labelS" color="textMuted">
          {eyebrow.toUpperCase()}
        </Txt>
        <Txt variant="displayS">{name}</Txt>
        <Txt variant="bodyS" color="textAccent">
          {meta}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 2,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    backgroundColor: color.bgRaised,
    overflow: 'hidden',
  },
  pressed: { borderColor: color.borderGold },
  photo: { height: 150, backgroundColor: color.bgPanel },
  text: { paddingTop: 12, paddingBottom: 14, paddingHorizontal: dimension.space4, gap: dimension.space1 },
});
