import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { boxShadow } from '../effects';
import { MOTION } from '../motion';
import { color, dimension } from '../tokens';
import { Art } from './Art';
import { Button } from './Button';
import { CornerCaps } from './Hardware';
import { InkLink } from './InkLink';
import { Overlay } from './Overlay';
import { scrimColor } from './Sheet';
import { Txt } from './Txt';

type Action = { label: string; onPress: () => void };

/** A question the person must answer: brass-bound panel, wax seal, one forged action and a way out. */
export function Dialog({
  open,
  title,
  body,
  confirm,
  cancel,
  seal = true,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: Action & { danger?: boolean };
  cancel: Action;
  seal?: boolean;
}) {
  const m = MOTION.sheetRise;
  return (
    <Overlay open={open} onBack={cancel.onPress}>
      <Animated.View
        entering={FadeIn.duration(m.duration)}
        exiting={FadeOut.duration(m.exit)}
        style={[StyleSheet.absoluteFill, styles.center]}
      >
        <Pressable
          onPress={cancel.onPress}
          style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }]}
          accessibilityLabel={cancel.label}
        />
        <Animated.View
          entering={ZoomIn.duration(m.duration)}
          style={styles.panel}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {seal && <Art name="seal_wax" fit="contain" style={{ width: 48, height: 48 }} />}
          <Txt variant="displayM" engraved align="center">
            {title}
          </Txt>
          <Txt variant="bodyM" color="textSecondary" align="center">
            {body}
          </Txt>
          <View style={{ height: 4 }} />
          <Button
            label={confirm.label}
            onPress={confirm.onPress}
            kind={confirm.danger ? 'danger' : 'forged'}
          />
          <InkLink label={cancel.label} onPress={cancel.onPress} />
          <CornerCaps />
        </Animated.View>
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: dimension.sizeGutter },
  panel: {
    width: 340,
    maxWidth: '100%',
    alignItems: 'center',
    gap: dimension.space4,
    paddingTop: 28,
    paddingHorizontal: dimension.space5,
    paddingBottom: dimension.sizeGutter,
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderBrass,
    boxShadow: boxShadow('shadowDeep'),
  },
});
