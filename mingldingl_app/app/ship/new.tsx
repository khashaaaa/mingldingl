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
import { shipInviteMessage } from '../../lib/shipInvite';
import { useLocaleStore } from '../../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');
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

  function shareInvite(code: string | null) {
    Share.share({ message: shipInviteMessage(code ?? '') });
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
          placeholderTextColor={COLORS.textDim as any}
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
          placeholderTextColor={COLORS.textDim as any}
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
  form: { padding: SPACE.xl, gap: SPACE.md },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  label: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: COLORS.gold, letterSpacing: 1, marginTop: SPACE.sm },
  error: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.emberLight },
  confirmWrap: { padding: SPACE.xl, gap: SPACE.lg, alignItems: 'center' },
  confirmText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, color: COLORS.text, textAlign: 'center' },
});
