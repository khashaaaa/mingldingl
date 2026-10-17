import { StyleSheet, View } from 'react-native';
import { t } from '@/lib/i18n';
import { color, dimension } from '../tokens';
import { Txt } from './Txt';

/** Onboarding progress: climbed rungs gold, the current one long and bright, the rest unlit. */
export function StepLadder({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.row}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        return (
          <View
            key={n}
            testID="rung"
            style={[
              styles.rung,
              n < step && { backgroundColor: color.accentGold },
              n === step && styles.current,
            ]}
          />
        );
      })}
      <Txt variant="labelS" color="textMuted">
        {t('common.stepOf', { step, total })}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: dimension.space2 },
  rung: { width: 14, height: 3, borderRadius: 1, backgroundColor: color.borderHairline },
  current: { width: 28, backgroundColor: color.accentGoldBright },
});
