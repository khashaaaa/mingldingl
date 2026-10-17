import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { Input } from '@/design/components/Input';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SealStamp } from '@/design/components/SealStamp';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { weaveThread } from '@/lib/api/generated/engine';
import type { WovenView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { threadLink } from '@/lib/links';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 8);

/** Weave a thread (Figma 33:2263), then send each their invitation (33:2338). */
export default function Weave() {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [woven, setWoven] = useState<WovenView | null>(null);
  const header = <RoomHeader title={t('room.threads')} onBack={() => router.back()} />;

  if (woven) {
    const share = (code: string) =>
      Share.share({ message: t('weave.invitation', { link: threadLink(code), code }) }).catch(() => {});
    return (
      <Scene
        header={header}
        footer={
          <>
            <Button label={t('weave.shareFirst')} onPress={() => share(woven.firstCode)} block />
            <Button
              kind="plain"
              label={t('weave.shareSecond')}
              onPress={() => share(woven.secondCode)}
              block
            />
          </>
        }
      >
        {/* Figma 33:2338: the wax and the words high in the room, the invitations at the foot */}
        <View style={styles.spun}>
          <SealStamp size={64} onLand={() => feedback('sealStamp')} />
          <Reveal delay={600}>
            <Txt variant="displayL" engraved align="center" accessibilityRole="header">
              {t('weave.spunTitle')}
            </Txt>
          </Reveal>
          <Reveal delay={600} order={1}>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {t('weave.spunBody')}
            </Txt>
          </Reveal>
        </View>
      </Scene>
    );
  }

  const weave = async () => {
    setBusy(true);
    try {
      setWoven(await weaveThread({ first, second }));
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Scene
      header={header}
      footer={
        <Button
          label={t('weave.weave')}
          onPress={weave}
          loading={busy}
          disabled={first.length !== 8 || second.length !== 8}
          block
        />
      }
    >
      <View style={styles.head}>
        <Txt variant="displayL" engraved accessibilityRole="header">
          {t('weave.title')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary">
          {t('weave.body')}
        </Txt>
      </View>
      <Input
        label={t('weave.first')}
        prefix="+976"
        value={first}
        onChangeText={(s) => setFirst(digits(s))}
        keyboardType="number-pad"
        placeholder={t('phone.placeholder')}
      />
      <Input
        label={t('weave.second')}
        prefix="+976"
        value={second}
        onChangeText={(s) => setSecond(digits(s))}
        keyboardType="number-pad"
        placeholder={t('phone.placeholder')}
      />
      <Txt variant="labelS" color="textSecondary">
        {t('weave.hint').toUpperCase()}
      </Txt>
    </Scene>
  );
}

const styles = StyleSheet.create({
  head: { gap: dimension.space2 },
  spun: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space5 },
});
