import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { boxShadow } from '@/design/effects';
import { color, dimension } from '@/design/tokens';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { useVerification, type VerificationPurpose } from './useVerification';

/** "482913" → "482 913": two groups read and type more easily. */
const grouped = (code: string) => code.replace(/^(\d{3})(\d+)$/, '$1 $2');

/**
 * The person texts our code to 144773 from the number they claim; verify.mn tells the engine.
 * Nothing is typed here. Once the number is proven the session is stored and the gate takes over.
 */
export default function VerifyScreen() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  return <Verify phone={phone} room={t('room.gate')} />;
}

/** The same proof from inside the world (War Room → Your sigil), under the room it was asked from. */
export function Verify({
  phone,
  room,
  purpose,
}: {
  phone: string;
  room: string;
  purpose?: VerificationPurpose;
}) {
  const { state, newCode, retry } = useVerification(phone, purpose);
  const [openFailed, setOpenFailed] = useState(false);
  const header = <RoomHeader title={room} onBack={router.back} />;

  useEffect(() => {
    if (state.kind === 'opening') feedback('sealBreak');
  }, [state.kind]);

  switch (state.kind) {
    case 'starting':
      return (
        <Scene header={header} centered>
          <Art name="candle_lit" style={styles.candle} fit="contain" />
        </Scene>
      );
    case 'opening':
      return (
        <Scene header={header} centered>
          <Art name="seal_wax" style={styles.seal} fit="contain" />
          <Txt variant="displayL" color="textAccent" engraved align="center" accessibilityRole="header">
            {t('verify.opensTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('verify.opensBody')}
          </Txt>
        </Scene>
      );
    case 'expired':
      return (
        <Scene
          header={header}
          centered
          footer={<Button block label={t('verify.newCode')} onPress={newCode} />}
        >
          <StateBlock kind="error" title={t('verify.expiredTitle')} body={t('verify.expiredBody')} />
        </Scene>
      );
    case 'failed': {
      const offline = state.error.kind === 'network';
      return (
        <Scene header={header} centered>
          <StateBlock
            kind={offline ? 'offline' : 'error'}
            title={t(offline ? 'state.offlineTitle' : 'state.errorTitle')}
            body={
              offline
                ? t('state.offlineBody')
                : state.error.kind === 'rule'
                  ? tError(state.error.code, state.error.message)
                  : t('error.generic')
            }
            // The engine refused the number itself (taken, malformed): trying it again cannot help.
            action={
              state.error.kind === 'rule'
                ? { label: t('verify.otherNumber'), onPress: router.back }
                : { label: t('common.tryAgain'), onPress: retry }
            }
          />
        </Scene>
      );
    }
    case 'waiting': {
      const { v } = state;
      return (
        <Scene
          header={header}
          footer={
            <>
              {openFailed && (
                <Txt variant="bodyS" color="textDanger" align="center" accessibilityLiveRegion="polite">
                  {t('verify.openFailed')}
                </Txt>
              )}
              <Button
                block
                label={t('verify.openMessages')}
                onPress={() => Linking.openURL(v.smsUri).catch(() => setOpenFailed(true))}
              />
              <InkLink label={t('verify.otherNumber')} onPress={router.back} />
            </>
          }
        >
          <View style={styles.code}>
            <Txt variant="displayM" engraved align="center">
              {t('verify.title')}
            </Txt>
            <Txt
              variant="displayXL"
              color="textAccent"
              align="center"
              selectable
              accessibilityLabel={v.code.split('').join(' ')}
            >
              {grouped(v.code)}
            </Txt>
            <Txt variant="numberL" align="center">
              {t('verify.to')}
            </Txt>
          </View>
          {/* verify.mn's own words, verbatim: they are the provider's instruction, not ours to rewrite. */}
          <View style={styles.instruction}>
            <Txt variant="bodyS" color="textSecondary" align="center">
              {v.displayInstruction}
            </Txt>
          </View>
          <View style={styles.waiting} accessibilityLiveRegion="polite">
            <View style={[styles.ember, { boxShadow: boxShadow('glowEmber') }]} />
            <Txt variant="voiceM" color="textSecondary">
              {t('verify.waiting')}
            </Txt>
          </View>
        </Scene>
      );
    }
  }
}

const styles = StyleSheet.create({
  candle: { width: 24, height: 72 },
  seal: { width: 64, height: 64 },
  code: { alignItems: 'center', gap: dimension.space2 },
  instruction: {
    padding: dimension.space4,
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderRadius: dimension.radiusSm,
  },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ember: { width: 8, height: 12, borderRadius: 6, backgroundColor: color.accentEmber },
});
