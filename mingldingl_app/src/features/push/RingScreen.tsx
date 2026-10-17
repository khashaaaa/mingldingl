import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Reveal } from '@/design/components/Reveal';
import { Swing } from '@/design/components/Swing';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { feedback } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { answerRing } from '@/lib/push';
import { Scene } from '../common/Scene';

/** "May we ring for you?" (Figma 36:678) — before the system ask, once, after the first bond. */
export default function RingScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [busy, setBusy] = useState(false);
  const answer = async (yes: boolean) => {
    setBusy(true);
    await answerRing(yes).catch(() => undefined);
    if (next) router.replace(next as Href);
    else router.back();
  };
  return (
    <Scene
      centered
      footer={
        <>
          <Button label={t('push.yes')} onPress={() => answer(true)} loading={busy} block />
          <InkLink label={t('push.no')} onPress={() => answer(false)} />
        </>
      }
    >
      <Swing onRing={rang}>
        <Art name="push_bell" style={styles.art} fit="cover" />
      </Swing>
      <Reveal order={2}>
        <Txt variant="displayL" engraved align="center" accessibilityRole="header">
          {t('push.title')}
        </Txt>
      </Reveal>
      <Reveal order={3} style={styles.lifted}>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {t('push.body')}
        </Txt>
      </Reveal>
    </Scene>
  );
}

const rang = () => feedback('bell');

const styles = StyleSheet.create({
  art: { width: 160, height: 140 },
  // Figma holds the bell in the upper third, not the middle
  lifted: { marginBottom: dimension.space8 * 2 },
});
