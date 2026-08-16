import { useState } from 'react';
import { View, Text, Share, StyleSheet } from 'react-native';
import { Input } from 'tamagui';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { GameButton } from '../../components/ui/GameButton';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { apiClient } from '../../lib/api/apiClient';
import { getApiErrorMessage } from '../../lib/api/errors';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');
const PHONE_REGEX = /^\d{8}$/;

// Maps the engine's raw validation strings (ShipService.CreateAsync) to
// i18n keys so they render in the user's language instead of always in
// English — getApiErrorMessage's fallback-to-raw-string behavior is fine
// for developer-facing errors, but these are shown directly to end users.
const SHIP_ERROR_I18N_KEYS: Record<string, string> = {
  'Phone numbers must be 8 digits': 'ship_error_invalid_phone',
  'Cannot weave a thread to yourself': 'ship_error_self',
  'Cannot weave a thread to the same person twice': 'ship_error_duplicate',
  'Daily thread limit reached': 'ship_error_daily_cap',
};

export default function NewShipScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
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
      // The engine returns 200 only on success (always Success: true in that
      // case) and 400 + { error } otherwise — axios throws on the 400, so a
      // resolved promise here always means the thread was woven. A code
      // comes back for both slots regardless of whether either phone number
      // resolved to an existing account (privacy constraint — see
      // ShipService.CreateAsync) — this screen never learns which.
      const response = await apiClient.ships.create(slotA, slotB);
      setCodes({ slotACode: response.slotACode ?? null, slotBCode: response.slotBCode ?? null });
      setSent(true);
    } catch (err) {
      const raw = getApiErrorMessage(err, '');
      const key = raw ? SHIP_ERROR_I18N_KEYS[raw] : undefined;
      setError(key ? i18n.t(key) : raw || i18n.t('ship_create_error'));
    } finally {
      setLoading(false);
    }
  }

  function shareInvite(code: string | null) {
    Share.share({ message: String(i18n.t('ship_invite_message', { code: code ?? '' })) });
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
        <ScreenHeader title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmText}>{i18n.t('ship_sent_confirmation')}</Text>
          <GameButton variant="primary" onPress={() => shareInvite(codes.slotACode)}>
            {i18n.t('share_thread_invite_a')}
          </GameButton>
          <GameButton variant="primary" onPress={() => shareInvite(codes.slotBCode)}>
            {i18n.t('share_thread_invite_b')}
          </GameButton>
          <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
      <ScreenHeader title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
      <View style={styles.form}>
        <Text style={styles.hint}>{i18n.t('weave_thread_hint')}</Text>
        <Text style={styles.label}>{i18n.t('first_thread_label')}</Text>
        <Input
          placeholder={i18n.t('phone_placeholder')}
          value={slotA}
          onChangeText={setSlotA}
          keyboardType="phone-pad"
          maxLength={8}
          backgroundColor={COLORS.panel}
          borderColor={COLORS.bronze}
          color={COLORS.text}
        />
        <Text style={styles.label}>{i18n.t('second_thread_label')}</Text>
        <Input
          placeholder={i18n.t('phone_placeholder')}
          value={slotB}
          onChangeText={setSlotB}
          keyboardType="phone-pad"
          maxLength={8}
          backgroundColor={COLORS.panel}
          borderColor={COLORS.bronze}
          color={COLORS.text}
        />
        {error && <Text style={styles.error}>{error}</Text>}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  form: { padding: 20, gap: 12 },
  hint: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  label: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 1, marginTop: 8 },
  error: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ember },
  confirmWrap: { padding: 20, gap: 16, alignItems: 'center' },
  confirmText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, textAlign: 'center' },
});
