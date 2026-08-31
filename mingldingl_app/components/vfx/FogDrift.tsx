import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Blur, Group } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, useDerivedValue, Easing } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { width: number; height: number; }

export function FogDrift({ width, height }: Props) {
  const level = useVfxLevel();

  if (level !== 'full' || width === 0) return null;
  return <SkiaFogDrift width={width} height={height} />;
}

function SkiaFogDrift({ width, height }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const cx1 = useDerivedValue(() => width * 0.25 + t.value * width * 0.5);
  const cx2 = useDerivedValue(() => width * 0.75 - t.value * width * 0.5);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Canvas style={{ width, height }}>
        <Group opacity={0.07}>
          <Circle cx={cx1} cy={height * 0.4} r={width * 0.3} color={COLORS.textDim}>
            <Blur blur={40} />
          </Circle>
          <Circle cx={cx2} cy={height * 0.65} r={width * 0.25} color={COLORS.textDim}>
            <Blur blur={40} />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}
