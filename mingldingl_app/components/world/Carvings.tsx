import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import type { RoomName } from '../../lib/world';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { CARVING, TAB_BAR_HEIGHT } from '../../lib/theme';
import { CARVING_ASPECT, CARVING_IMAGES, PAINTED_ROOMS } from './carvingImages';

/**
 * The room's frieze: figures cut into the stone along the foot of the screen (`scripts/gen-carvings.js`
 * draws them). It sits on the floor layer, under the room's rising light, so the carvings are seen
 * the way a carving is seen at night — where the fire reaches.
 *
 * Quiet on purpose. A textured wall was tried once and fought every card on the screen; a frieze is
 * only marks, in the one band of the screen a list scrolls through last, and at an alpha that lets
 * body copy pass over it. The Deep's figures are painted in ochre rather than pecked pale, which is
 * a darker mark, so it is allowed to come up further.
 */

/** Opacity at no light … at full light. The carvings are *more* there when the room is lit. */
const CARVED_ALPHA: readonly [number, number] = [0.12, 0.2];
const PAINTED_ALPHA: readonly [number, number] = [0.22, 0.34];

/** Never let a wide screen turn the band into a mural: past this width it stops growing. */
const MAX_WIDTH = 540;

/**
 * The last room whose frieze was shown. Every stack screen lays its own floor, so a push inside a
 * room mounts a new frieze — and replaying the torch on each push would flash the same wall in and
 * out. Only walking into a different room finds the carvings again.
 */
let lastFound: RoomName | null = null;

/** Brightening past where it settles, then back: the torch swung toward the wall, then held. */
const FIND_RISE_MS = 700;
const FIND_SETTLE_MS = 900;
const FIND_PEAK = 1.5;

interface Props {
  room: RoomName;
  light: SharedValue<number>;
}

export function Carvings({ room, light }: Props) {
  const level = useVfxLevel();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const onTabs = segments[0] === '(tabs)';
  const painted = PAINTED_ROOMS.includes(room);
  const [lo, hi] = painted ? PAINTED_ALPHA : CARVED_ALPHA;

  const entering = lastFound !== room && motionAllowed(level);
  const found = useSharedValue(entering ? 0 : 1);
  useEffect(() => {
    lastFound = room;
    if (entering) {
      found.value = withSequence(
        withTiming(FIND_PEAK, { duration: FIND_RISE_MS }),
        withTiming(1, { duration: FIND_SETTLE_MS }),
      );
    }
    // Only on mount: a room change mounts a fresh floor, never re-renders this one into another room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, light.value));
    return { opacity: (lo + (hi - lo) * t) * found.value };
  }, [lo, hi]);

  const source = CARVING_IMAGES[room];
  if (!source) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.band, { bottom: onTabs ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom }]}
      testID={`carvings-${room}`}
    >
      <Animated.Image
        source={source}
        resizeMode="contain"
        style={[styles.frieze, { tintColor: painted ? CARVING.ochre : CARVING.stone }, style]}
      />
    </View>
  );
}

/** Test seam: forget which room was last found. */
export function resetCarvingsForTest() {
  lastFound = null;
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  frieze: { width: '100%', maxWidth: MAX_WIDTH, aspectRatio: CARVING_ASPECT },
});
