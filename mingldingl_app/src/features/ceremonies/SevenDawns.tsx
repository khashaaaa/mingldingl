import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { CountUp } from '@/design/components/CountUp';
import { DawnStreak } from '@/design/components/DawnStreak';
import { Reveal } from '@/design/components/Reveal';
import { Txt } from '@/design/components/Txt';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { Veil } from './Veil';

/** The seventh dawn (Figma 36:388): seven lit dots, the last an ember, and the bonus counting up. */
export default function SevenDawns() {
  const { points } = useLocalSearchParams<{ points?: string }>();
  const bonus = Number(points) || 0;
  return (
    <Veil>
      <Scene footer={<Button label={t('ceremony.continue')} onPress={() => router.back()} block />}>
        <View style={styles.column}>
          <Reveal style={styles.row}>
            <DawnStreak lit={7} line={t('ceremony.dawnTitle')} />
          </Reveal>
          <CountUp
            value={bonus}
            format={(n) => `+${n}`}
            delay={400}
            variant="displayXL"
            color="textAccent"
            align="center"
          />
          <Reveal delay={600}>
            <Txt variant="voiceL" color="textSecondary" align="center">
              {t('ceremony.dawnBody')}
            </Txt>
          </Reveal>
        </View>
      </Scene>
    </Veil>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 18, paddingTop: 208 },
  row: { alignSelf: 'stretch' },
});
