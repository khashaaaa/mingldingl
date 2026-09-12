import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { i18n } from '../../lib/i18n';
import { METAL, SPACE, SURFACE, tint } from '../../lib/theme';

export const SEAL_COUNT = 3;

/** Level 1 is the floor every match is born with; the three seals are rungs 2, 3 and 4. */
export function sealsBroken(revealLevel: number | undefined): number {
  return Math.max(0, Math.min(SEAL_COUNT, (revealLevel ?? 1) - 1));
}

interface Props {
  broken: number;
  /** The wax. Gold everywhere but the Fire, which passes the furnace. */
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The reveal ladder as three wax seals. An intact seal is a filled disc of wax; a broken one is
 * the ring the wax left. One image for accessibility — three dots read aloud one by one say
 * nothing — with the count as its label.
 */
export function SealDots({ broken, color = METAL.gold, size = 10, style }: Props) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="image"
      accessibilityLabel={i18n.t(`seals_broken_${broken}`)}
    >
      {Array.from({ length: SEAL_COUNT }, (_, i) => {
        const isBroken = i < broken;
        return (
          <View
            key={i}
            testID={isBroken ? 'seal-dot-broken' : 'seal-dot-intact'}
            style={[
              { width: size, height: size, borderRadius: size / 2 },
              isBroken
                ? { borderWidth: 1.5, borderColor: tint(color, 0.7), backgroundColor: 'transparent' }
                : { backgroundColor: color, borderWidth: 1, borderColor: tint(SURFACE.sunken, 0.35) },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});
