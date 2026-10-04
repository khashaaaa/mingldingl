import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { MATERIAL } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { BOX, METAL_IMAGES } from './metal';

interface Props {
  open: boolean;
  size?: number;
}

type Part = keyof typeof METAL_IMAGES.box;

/**
 * The iron-bound strongbox a drop arrives in, baked in two halves (`scripts/gen-metal.js`) so the
 * lid can lift. Wood and fittings are white silhouettes tinted here — oak, and gold for the
 * bands, because gold is what opens or rewards (`MATERIAL`) — with the light drawn over them.
 *
 * Opening tips the lid back: it rises off the body and foreshortens, hinged at its rear edge.
 * Reduce-motion shows it simply open.
 */
export function Strongbox({ open, size = BOX }: Props) {
  const animate = motionAllowed(useVfxLevel());
  const lift = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (!animate) { lift.setValue(open ? 1 : 0); return; }
    const run = Animated.timing(lift, { toValue: open ? 1 : 0, duration: 380, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [open, animate, lift]);

  const box = { width: size, height: size };
  // The lid's hinge is its back edge, about half-way down the bake; scaling about the centre and
  // shifting by the same amount keeps that edge where it is while the front swings up.
  const hingeY = size * 0.49;
  const lidStyle = {
    transform: [
      { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.1] }) },
      { translateY: hingeY },
      { scaleY: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
      { translateY: -hingeY },
    ],
  };

  return (
    <View style={box} accessible={false} importantForAccessibility="no" testID={open ? 'strongbox-open' : 'strongbox-shut'}>
      <Layers part="body" size={size} />
      <Animated.View style={[StyleSheet.absoluteFill, lidStyle]}>
        <Layers part="lid" size={size} />
      </Animated.View>
    </View>
  );
}

function Layers({ part, size }: { part: Part; size: number }) {
  const img = { position: 'absolute' as const, width: size, height: size };
  const set = METAL_IMAGES.box[part];
  return (
    <>
      <Image source={set.wood} style={[img, { tintColor: MATERIAL.wood }]} />
      <Image source={set.iron} style={[img, { tintColor: MATERIAL.gold }]} />
      <Image source={set.detail} style={img} />
    </>
  );
}
