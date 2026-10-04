import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Blur, Canvas, DisplacementMap, Image as SkiaImage, Turbulence, makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { Easing, runOnJS, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { InkBleedingContext } from './inkBleedContext';

/** How long the ink takes to settle from ragged to crisp. */
const BLEED_MS = 1100;
/** How far the wet edge wanders at first, in points, and how soft it is. */
const SPREAD = 26;
const SOFTEN = 4;
/**
 * After a hold, how long the views get before they are photographed. A screen coming back from
 * behind another hands its images and borders to Android a few frames late; photographed at once,
 * a quest came out as bare text and its portrait popped in when the bleed handed over.
 */
const UNHOLD_SETTLE_MS = 150;

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** False shows the children at once, as they are: for a thing that has been seen before. */
  bleed?: boolean;
  /** True keeps an arrival waiting, hidden and unphotographed, until it can be seen. */
  hold?: boolean;
  testID?: string;
}

/**
 * A thing arriving soaks in like ink on wet paper: ragged and feathered first, then crisp.
 *
 * The children are laid out hidden, photographed once (`makeImageFromView`), and that picture is
 * drawn in Skia pulled about by turbulence and softened by a blur, both easing to nothing; when
 * it has settled, the real views take its place. One short canvas for one moment, so it is kept
 * to arrivals that matter: a reward, a new quest. If the photograph fails, or motion is off, the
 * children simply show.
 */
export function InkBleed({ children, style, bleed = true, hold = false, testID }: Props) {
  const animate = motionAllowed(useVfxLevel()) && bleed;
  const inner = useRef<View>(null);
  const [phase, setPhase] = useState<'wait' | 'bleed' | 'done'>(animate ? 'wait' : 'done');
  const [image, setImage] = useState<SkImage | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const k = useSharedValue(0);
  const wasHeld = useRef(hold);
  if (hold) wasHeld.current = true;

  useEffect(() => {
    if (phase !== 'wait' || !size || hold) return;
    let cancelled = false;
    let raf = 0;
    const photograph = () => {
      let shot: Promise<SkImage | null>;
      try {
        shot = makeImageFromView(inner);
      } catch {
        setPhase('done');
        return;
      }
      Promise.resolve(shot).then((img) => {
        if (cancelled) return;
        if (!img) { setPhase('done'); return; }
        setImage(img);
        setPhase('bleed');
        k.value = withTiming(1, { duration: BLEED_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(setPhase)('done');
        });
      }, () => { if (!cancelled) setPhase('done'); });
    };
    // A frame for the children to paint before they are photographed.
    const settle = setTimeout(() => { raf = requestAnimationFrame(photograph); }, wasHeld.current ? UNHOLD_SETTLE_MS : 0);
    return () => { cancelled = true; clearTimeout(settle); cancelAnimationFrame(raf); };
  }, [phase, size, hold, k]);

  const spread = useDerivedValue(() => SPREAD * (1 - k.value));
  const soften = useDerivedValue(() => SOFTEN * (1 - k.value));
  const opacity = useDerivedValue(() => Math.min(1, k.value * 2.2));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size?.w || height !== size?.h)) setSize({ w: width, h: height });
  };

  return (
    <View style={style} testID={testID}>
      {/* Hidden by this wrapper, not by the photographed view itself, so the picture is not blank. */}
      <View style={phase === 'done' ? undefined : styles.hidden}>
        <View ref={inner} collapsable={false} onLayout={onLayout}>
          <InkBleedingContext.Provider value={phase !== 'done'}>{children}</InkBleedingContext.Provider>
        </View>
      </View>
      {phase === 'bleed' && image && size && (
        <Canvas style={[styles.canvas, { width: size.w, height: size.h }]} pointerEvents="none">
          <SkiaImage image={image} x={0} y={0} width={size.w} height={size.h} fit="fill" opacity={opacity}>
            <Blur blur={soften}>
              <DisplacementMap channelX="r" channelY="g" scale={spread}>
                <Turbulence freqX={0.035} freqY={0.035} octaves={3} seed={7} />
              </DisplacementMap>
            </Blur>
          </SkiaImage>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  canvas: { position: 'absolute', top: 0, left: 0 },
});
