import { useState } from 'react';
import { View, Text, Share, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HeaderBar } from '../../components/ui/HeaderBar';
import { GameButton } from '../../components/ui/GameButton';
import { TextField } from '../../components/ui/TextField';
import { apiClient } from '../../lib/api/apiClient';
import { getApiErrorMessage } from '../../lib/api/errors';
import { i18n } from '../../lib/i18n';
import { shipInviteMessage } from '../../lib/shipInvite';
import { useLocaleStore } from '../../store/localeStore';
import { ACCENT, FONTS, FONT_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { FieldError } from '../../components/ui/StateBlock';
const PHONE_REGEX = /^\d{8}$/;

export default function NewShipScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const [slotA, setSlotA] = useState('');
  const [slotB, setSlotB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [codes, setCodes] = useState<{ slotACode: string | null; slotBCode: string | null }>({
    slotACode: null,
    slotBCode: null,
  });

  const canSubmit = PHONE_REGEX.test(slotA) && PHONE_REGEX.test(slotB);

  async function handleWeave() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.ships.create(slotA, slotB);
      setCodes({ slotACode: response.slotACode ?? null, slotBCode: response.slotBCode ?? null });
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, i18n.t('ship_create_error')));
    } finally {
      setLoading(false);
    }
  }

  function shareInvite(code: string) {
    Share.share({ message: shipInviteMessage(code) });
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <HeaderBar title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmText}>{i18n.t('ship_sent_confirmation')}</Text>
          {/* A nominee who already has an account is invited in-app and gets no code, so there is
              nothing to share for that slot. */}
          {codes.slotACode !== null && (
            <GameButton variant="ink" onPress={() => shareInvite(codes.slotACode!)}>
              {i18n.t('share_thread_invite_a')}
            </GameButton>
          )}
          {codes.slotBCode !== null && (
            <GameButton variant="ink" onPress={() => shareInvite(codes.slotBCode!)}>
              {i18n.t('share_thread_invite_b')}
            </GameButton>
          )}
          <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBar title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
      <View style={styles.form}>
        <Text style={styles.hint}>{i18n.t('weave_thread_hint')}</Text>
        <Text style={styles.label}>{i18n.t('first_thread_label')}</Text>
        <TextField
          placeholder={i18n.t('phone_placeholder')}
          value={slotA}
          onChangeText={setSlotA}
          keyboardType="phone-pad"
          maxLength={8}
        />
        <Text style={styles.label}>{i18n.t('second_thread_label')}</Text>
        <TextField
          placeholder={i18n.t('phone_placeholder')}
          value={slotB}
          onChangeText={setSlotB}
          keyboardType="phone-pad"
          maxLength={8}
        />
        {error && <FieldError>{error}</FieldError>}
        <GameButton
          variant="primary"
          icon="bow-arrow"
          loading={loading}
          disabled={!canSubmit || loading}
          onPress={handleWeave}
        >
          {i18n.t('weave_thread_button')}
        </GameButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  form: { padding: SPACE.xl, gap: SPACE.md },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  label: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: ACCENT.base, letterSpacing: TRACKING.wide, marginTop: SPACE.sm },
  confirmWrap: { padding: SPACE.xl, gap: SPACE.lg, alignItems: 'center' },
  confirmText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: INK.primary, textAlign: 'center' },
});
