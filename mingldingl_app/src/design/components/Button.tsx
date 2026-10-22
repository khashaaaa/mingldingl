import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { feedback } from '@/lib/feedback';
import { boxShadow } from '../effects';
import { color, component, dimension, easing } from '../tokens';
import { FillArt } from './Art';
import { Fastener } from './Hardware';
import { Txt } from './Txt';

type Props = {
  label: string;
  onPress: () => void;
  /** Forged brass; Plain is a bare outline for the lesser action; Danger edges the brass in ember. */
  kind?: 'forged' | 'plain' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the parent's width (screen-level actions). */
  block?: boolean;
};

/**
 * The forged button: worn brass plate, two rivets, caps label. Press sinks 2 px on the anvil spring.
 * Disabled it is unlit iron — a hairline outline and faint words, no brass — never dimmed brass,
 * which reads as a brown stain on the night.
 */
export function Button({ label, onPress, kind = 'forged', disabled, loading, block }: Props) {
  const sink = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: sink.value }] }));
  const inert = disabled || loading;
  const spring = { damping: easing.anvil.damping, stiffness: easing.anvil.stiffness };
  const unlit = !!disabled;
  const plain = kind === 'plain' || unlit;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inert}
      onPressIn={() => {
        sink.value = withSpring(2, spring);
        feedback('press');
      }}
      onPressOut={() => {
        sink.value = withSpring(0, spring);
      }}
      onPress={onPress}
      style={block && { alignSelf: 'stretch' }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.plate,
            {
              borderColor: unlit
                ? color.borderHairline
                : kind === 'danger'
                  ? color.statusDanger
                  : plain
                    ? color.borderStrong
                    : color.borderGold,
            },
            plain && { borderTopWidth: dimension.strokeHairline },
            !pressed && !plain && { boxShadow: boxShadow('shadowRaised') },
            style,
          ]}
        >
          {!plain && <FillArt name="brass_plate" />}
          {pressed && <View style={[StyleSheet.absoluteFill, { backgroundColor: component.pressDarken }]} />}
          <View style={styles.row}>
            {!plain && <Fastener kind="rivet" size={10} />}
            <Txt
              variant="labelM"
              color={unlit ? 'textMuted' : plain ? 'textPrimary' : 'bgBase'}
              numberOfLines={1}
            >
              {label}
            </Txt>
            {!plain && <Fastener kind="rivet" size={10} />}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    height: 52,
    justifyContent: 'center',
    borderWidth: dimension.strokeHairline,
    borderTopWidth: dimension.strokeRule,
    borderRadius: dimension.radiusSm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: dimension.space3,
    paddingHorizontal: dimension.space5,
  },
});
