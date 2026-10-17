import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { color } from '../tokens';
import { Art } from './Art';
import type { SealablePhoto } from './PhotoTile';

/**
 * A round portrait. Sealed shows only the ThumbHash blur under a wax seal — the photo's URL is never
 * requested, so a sealed face cannot be pulled from the network or the cache.
 */
export function AvatarFrame({
  state,
  photo,
  label,
  size = 72,
}: {
  state: 'sealed' | 'revealed' | 'mine';
  photo: SealablePhoto | null;
  label: string;
  size?: number;
}) {
  const face = size * (60 / 72);
  const seal = size * (20 / 72);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width: size, height: size }]}
    >
      <View style={[styles.face, { width: face, height: face, borderRadius: face / 2 }]}>
        {photo &&
          (state === 'sealed' || !photo.url ? (
            <Image
              source={{ thumbhash: photo.thumbHash }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Image
              source={{ uri: photo.url ?? undefined, cacheKey: photo.id }}
              placeholder={{ thumbhash: photo.thumbHash }}
              recyclingKey={photo.id}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
          ))}
      </View>
      {state === 'sealed' && (
        <View
          testID="avatar-seal"
          style={[styles.seal, { width: seal, height: seal, right: size * 0.1, bottom: size * 0.1 }]}
        >
          <Art name="seal_wax" style={{ width: seal, height: seal }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  face: { overflow: 'hidden', backgroundColor: color.bgPanel },
  seal: { position: 'absolute' },
});
