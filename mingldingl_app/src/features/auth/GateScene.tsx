import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { t, useLocale } from '@/lib/i18n';
import { chooseLocale } from '@/lib/i18n/device';
import { Scene } from '../common/Scene';

/**
 * The first thing anyone sees. New or returning, both paths prove a number: a returning number
 * signs back in to its account, a new one starts a tale.
 */
export default function GateScene() {
  const locale = useLocale();
  const toPhone = () => router.push('/phone');
  return (
    <Scene
      centered
      footer={
        <>
          <Button block label={t('gate.enter')} onPress={toPhone} />
          <InkLink label={t('gate.returning')} onPress={toPhone} />
        </>
      }
    >
      {/* Names the other language in that language, so it reads to the person who needs it. */}
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => chooseLocale(locale === 'mn' ? 'en' : 'mn')}
        style={styles.language}
      >
        <Txt variant="labelS" color="textSecondary">
          {t('gate.language')}
        </Txt>
      </Pressable>
      <Art name="gate_scene" style={styles.art} />
      <Txt variant="titleRoom" color="textAccent" align="center" accessibilityRole="header">
        {t('app.name')}
      </Txt>
      <View style={styles.tagline}>
        <Txt variant="voiceL" color="textSecondary" align="center">
          {t('gate.tagline')}
        </Txt>
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  language: { position: 'absolute', top: dimension.space4, right: dimension.sizeGutter },
  art: { width: 280, height: 240, marginBottom: dimension.space2 },
  tagline: { maxWidth: 320 },
});
