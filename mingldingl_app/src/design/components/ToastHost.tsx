import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '@/lib/toast';
import { MOTION } from '../motion';
import { dimension } from '../tokens';
import { Toast } from './Toast';

/** Toasts drop in under the room header, over whatever screen is showing (Figma 36:457). */
export function ToastHost() {
  const items = useToasts();
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 64 }]}>
      {items.map((i) => (
        <Animated.View
          key={i.id}
          entering={FadeInUp.duration(MOTION.inkBleedIn.duration)}
          exiting={FadeOut.duration(MOTION.inkBleedIn.exit)}
        >
          <Toast kind={i.kind} message={i.message} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: dimension.sizeGutter,
    right: dimension.sizeGutter,
    gap: dimension.space2,
  },
});
