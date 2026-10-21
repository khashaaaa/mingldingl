import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { curve, MOTION } from '@/design/motion';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';

/** The longest a room waits for its first answers before it shows whatever it has. */
const WAIT_MS = 700;

/**
 * A newly opened room stays out of sight until the reads it started on its first draw have
 * answered (or WAIT_MS passes), then rises out of the floor whole (Room travel), instead of
 * filling in piece by piece.
 */
function Arrival({ navigation, children }: { navigation: Leaving; children: ReactNode }) {
  const client = useQueryClient();
  const fetching = useIsFetching();
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  // The room's own reads begin in its children's effects, which run before this one, so the
  // client is asked directly: on the first pass `fetching` has not seen them yet.
  useEffect(() => {
    if (ready || fetching > 0) return;
    if (client.isFetching() === 0) setReady(true);
  }, [client, ready, fetching]);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready)
      opacity.value = withTiming(1, {
        duration: MOTION.roomTravel.duration,
        easing: curve(MOTION.roomTravel.easing),
      });
  }, [ready, opacity]);
  // A room left by Back goes dark at once: the room under it is shown a frame before it is gone.
  // A room with unsaved edits may refuse to go: asked again once every listener has run.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        opacity.value = 0;
        queueMicrotask(() => {
          if (e.defaultPrevented) opacity.value = 1;
        });
      }),
    [navigation, opacity],
  );
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.room, style]}>{children}</Animated.View>;
}

/**
 * The world stack's `screenLayout`. Its screens are transparent over the one World Floor, so the
 * native push and pop showed the room left and the room entered through each other. The stack
 * swaps rooms at once instead, and the room entered arrives as above.
 */
export const roomLayout = (props: {
  route: { name: string };
  navigation: Leaving;
  children: ReactElement;
}) => <Arrival navigation={props.navigation}>{localeScreenLayout(props)}</Arrival>;

type Leaving = {
  addListener: (event: 'beforeRemove', listener: (e: { defaultPrevented: boolean }) => void) => () => void;
};

const styles = StyleSheet.create({ room: { flex: 1 } });
