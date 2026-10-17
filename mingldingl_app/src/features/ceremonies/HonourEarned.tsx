import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Reveal } from '@/design/components/Reveal';
import { SealStamp } from '@/design/components/SealStamp';
import { Txt } from '@/design/components/Txt';
import { seenHonour } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { emblem, honourText } from '../road/honours';
import { Veil } from './Veil';

/**
 * An honour earned (Figma 36:329; the festival one 97:730 adds its pennants): the emblem drops on
 * the anvil (0.9 s) with the success haptic and honour.wav, then its name and what it was for.
 * Opening it is seeing it: the engine stops offering the ceremony.
 */
export default function HonourEarned() {
  const { key } = useLocalSearchParams<{ key: string }>();
  useEffect(() => {
    seenHonour(key).catch(() => {});
  }, [key]);
  return (
    <Veil>
      <Scene
        footer={
          <Button kind="plain" label={t('honour.seeCase')} onPress={() => router.replace('/honours')} block />
        }
      >
        <View style={styles.column}>
          <SealStamp name={emblem(key)} size={160} onLand={landed} />
          <Reveal delay={TEXT_AT}>
            <Txt variant="displayXL" color="textAccent" align="center" accessibilityRole="header">
              {t(honourText(key, 'name'))}
            </Txt>
          </Reveal>
          <Reveal delay={TEXT_AT} order={1}>
            <Txt variant="voiceL" color="textSecondary" align="center">
              {t(honourText(key, 'did'))}
            </Txt>
          </Reveal>
        </View>
        {/* Figma 97:730: the pennants stand whole on the horizon, just above the button. */}
        {key === 'naadam' ? <Art name="naadam_pennants" style={styles.pennants} fit="contain" /> : null}
      </Scene>
    </Veil>
  );
}

const TEXT_AT = 900;
const landed = () => feedback('honourDrop');

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 16, paddingTop: 168 },
  pennants: { width: '100%', aspectRatio: 1050 / 306, marginTop: 'auto' },
});
