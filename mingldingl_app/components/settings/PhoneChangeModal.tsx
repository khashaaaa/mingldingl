import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { AlertModal } from '../modals/AlertModal';
import { GameButton } from '../ui/GameButton';
import { apiClient } from '../../lib/api/apiClient';
import { isPhoneValid, useAuth, VERIFICATION_POLL_MS } from '../../hooks/useAuth';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE } from '../../lib/theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onChanged: (phoneNumber: string) => void;
}

/**
 * Changing a number carries the same trust requirement as signing up, so it runs the full
 * verify.mn Mobile-Originated flow: the user texts a code to the shortcode from the new SIM.
 */
export function PhoneChangeModal({ visible, onDismiss, onChanged }: Props) {
  const { startPhoneVerification, checkVerification } = useAuth();
  const [phone, setPhone] = useState('');
  const [verification, setVerification] = useState<{ id: string; smsUri: string; instruction: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claiming = useRef(false);

  const reset = useCallback(() => {
    setPhone('');
    setVerification(null);
    setBusy(false);
    setError(null);
    claiming.current = false;
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  async function start() {
    if (!isPhoneValid(phone)) {
      setError(i18n.t('phone_invalid'));
      return;
    }
    setBusy(true);
    setError(null);
    const started = await startPhoneVerification(phone);
    setBusy(false);
    if (!started) {
      setError(i18n.t('verification_start_failed'));
      return;
    }
    setVerification({ id: started.verificationId, smsUri: started.smsUri, instruction: started.displayInstruction });
  }

  useEffect(() => {
    if (!verification) return;
    let cancelled = false;

    async function poll() {
      const outcome = await checkVerification(verification!.id);
      if (cancelled || claiming.current) return;
      if (outcome === 'expired') {
        setError(i18n.t('verify_expired_body'));
        setVerification(null);
        return;
      }
      if (outcome !== 'verified') return;

      claiming.current = true;
      try {
        const updated = await apiClient.users.changePhone(phone, verification!.id);
        if (!cancelled) onChanged(updated.phoneNumber ?? phone);
      } catch {
        if (!cancelled) {
          claiming.current = false;
          setError(i18n.t('phone_change_error'));
        }
      }
    }

    const id = setInterval(poll, VERIFICATION_POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [verification, phone, onChanged]);

  return (
    <AlertModal
      visible={visible}
      title={i18n.t('change_phone_title')}
      tone={error ? 'warning' : 'default'}
      message={error ?? ''}
      onDismiss={onDismiss}
    >
      {verification ? (
        <View style={styles.stack}>
          <Text style={styles.instruction}>{verification.instruction}</Text>
          <GameButton
            variant="primary"
            size="compact"
            icon="message-text"
            onPress={() => Linking.openURL(verification.smsUri).catch(() => setError(i18n.t('verify_open_sms_failed')))}
          >
            {i18n.t('verify_sms_open')}
          </GameButton>
          <View style={styles.waitingRow}>
            <ActivityIndicator color={COLORS.gold} size="small" />
            <Text style={styles.hint}>{i18n.t('verify_sms_waiting')}</Text>
          </View>
          <Text style={styles.hint}>{i18n.t('verify_sms_cost')}</Text>
        </View>
      ) : (
        <View style={styles.stack}>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(t) => { setPhone(t); if (error) setError(null); }}
            placeholder={i18n.t('new_phone_placeholder')}
            placeholderTextColor={COLORS.textDim}
            keyboardType="number-pad"
            maxLength={8}
          />
          <Text style={styles.hint}>{i18n.t('phone_change_verify_hint')}</Text>
          <GameButton
            variant="primary"
            size="compact"
            onPress={start}
            disabled={!isPhoneValid(phone) || busy}
            loading={busy}
          >
            {i18n.t('verify_now')}
          </GameButton>
        </View>
      )}
    </AlertModal>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.md },
  input: {
    height: 48,
    backgroundColor: COLORS.panelRaised,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.body,
  },
  instruction: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.text, textAlign: 'center', lineHeight: 20 },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
});
