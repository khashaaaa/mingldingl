import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Input } from '@/design/components/Input';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { CODE_LENGTH, useVerification, type VerificationPurpose } from './useVerification';

/** "88581234" → "8858 1234", as the person wrote it. */
const spaced = (phone: string) => phone.replace(/^(\d{4})(\d+)$/, '$1 $2');

const secondsUntil = (at: string) => Math.max(0, Math.ceil((Date.parse(at) - Date.now()) / 1000));

/** Seconds until `at`, never below zero, ticking once a second while there are any. */
function useSecondsUntil(at: string) {
  const [secs, setSecs] = useState(() => secondsUntil(at));
  useEffect(() => {
    setSecs(secondsUntil(at));
    const timer = setInterval(() => {
      const s = secondsUntil(at);
      setSecs(s);
      if (s === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [at]);
  return secs;
}

/**
 * WeSend texts a six-digit code to the number claimed; the person types it here. Once the number
 * is proven the session is stored and the gate takes over.
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
  const { state, submit, newCode, retry } = useVerification(phone, purpose);
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
    case 'waiting':
      return (
        <CodeEntry
          header={header}
          phone={phone}
          resendAt={state.v.resendAt}
          checking={!!state.checking}
          error={state.error ? tError(state.error.code, state.error.message) : null}
          onSubmit={submit}
          onNewCode={newCode}
        />
      );
  }
}

function CodeEntry({
  header,
  phone,
  resendAt,
  checking,
  error,
  onSubmit,
  onNewCode,
}: {
  header: ReactNode;
  phone: string;
  resendAt: string;
  checking: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onNewCode: () => void;
}) {
  const [code, setCode] = useState('');
  const field = useRef<TextInput>(null);
  const wait = useSecondsUntil(resendAt);
  const full = code.length === CODE_LENGTH;

  // A refused code is cleared for the next try, the keypad kept up.
  useEffect(() => {
    if (!error) return;
    setCode('');
    field.current?.focus();
  }, [error]);

  return (
    <Scene
      header={header}
      footer={
        <>
          <Button
            block
            label={t('verify.open')}
            onPress={() => onSubmit(code)}
            disabled={!full}
            loading={checking}
          />
          <InkLink
            label={wait > 0 ? t('verify.newCodeIn', { secs: wait }) : t('verify.newCode')}
            onPress={() => {
              setCode('');
              onNewCode();
            }}
            disabled={wait > 0 || checking}
          />
          <InkLink label={t('verify.otherNumber')} onPress={router.back} />
        </>
      }
    >
      <Txt variant="displayL" engraved accessibilityRole="header">
        {t('verify.title')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary">
        {t('verify.sentTo', { phone: spaced(phone) })}
      </Txt>
      <Input
        label={t('verify.codeLabel')}
        value={code}
        onChangeText={(s) => {
          const digits = s.replace(/\D/g, '').slice(0, CODE_LENGTH);
          setCode(digits);
          // The sixth digit (or a pasted or autofilled code) opens the gate at once.
          if (digits.length === CODE_LENGTH && !checking) onSubmit(digits);
        }}
        placeholder="······"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        ref={field}
        maxLength={CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => full && onSubmit(code)}
        disabled={checking}
        error={error}
      />
    </Scene>
  );
}

const styles = StyleSheet.create({
  candle: { width: 24, height: 72 },
  seal: { width: 64, height: 64 },
});
