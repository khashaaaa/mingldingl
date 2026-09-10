import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth, VERIFICATION_POLL_MS } from '../../hooks/useAuth';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { GameButton } from '../../components/ui/GameButton';
import { Icon } from '../../components/ui/Icon';
import { GateScene, type GateState } from '../../components/onboarding/GateScene';
import { signal } from '../../lib/world/feedback';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';


/**
 * verify.mn is Mobile-Originated: the user sends our code to the shortcode rather than receiving
 * one. So this screen shows the provider's instruction, offers a one-tap pre-filled SMS, and
 * polls for the result — there is no code to type in.
 */
export default function OtpScreen() {
  useLocaleStore((s) => s.locale);
  const params = useLocalSearchParams<{
    phone: string;
    verificationId: string;
    smsUri: string;
    code: string;
    displayInstruction: string;
    shortcode: string;
    expiresAt: string;
  }>();
  const { phone, verificationId, smsUri, code, displayInstruction, shortcode, expiresAt } = params;
  const { checkVerification, completeSignIn, loading, error } = useAuth();
  const router = useRouter();

  const [expired, setExpired] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  // True from the moment the poll says `verified` until sign-in either lands or fails. The gate
  // opens on the provider's word, not on our own success, so the person sees it swing the instant
  // the engine does.
  const [opened, setOpened] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const completing = useRef(false);

  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const secondsLeft = Math.max(0, Math.round((expiresAtMs - now) / 1000));

  const restart = useCallback(() => router.replace('/(auth)/phone'), [router]);

  useEffect(() => {
    if (!verificationId) restart();
  }, [verificationId, restart]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Poll no faster than 3s per verify.mn guidance, and stop the moment it is terminal so the
  // user is never nudged into sending (and paying for) a second SMS.
  useEffect(() => {
    if (!verificationId || expired) return;
    let cancelled = false;

    async function poll() {
      const outcome = await checkVerification(verificationId);
      if (cancelled) return;
      if (outcome === 'verified') {
        if (completing.current) return;
        completing.current = true;
        setOpened(true);
        signal('ascend');
        const ok = await completeSignIn(verificationId, phone);
        if (!ok && !cancelled) {
          completing.current = false;
          setOpened(false);
        }
        return;
      }
      if (outcome === 'expired') setExpired(true);
    }

    const id = setInterval(poll, VERIFICATION_POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [verificationId, expired, phone]);

  useEffect(() => {
    if (secondsLeft === 0 && expiresAtMs > 0) setExpired(true);
  }, [secondsLeft, expiresAtMs]);

  async function openSmsApp() {
    setOpenFailed(false);
    try {
      await Linking.openURL(smsUri);
      signal('horn');
    } catch {
      setOpenFailed(true);
    }
  }

  if (!verificationId) return null;

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const gate: GateState = expired ? 'barred' : opened ? 'opening' : 'closed';

  return (
    // The provider's instruction copy is variable-length and this screen has no other escape
    // hatch, so it has to be able to scroll rather than clip on a short phone.
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>{i18n.t('verify_title')}</Text>
      <Text style={styles.phone}>+976 {phone}</Text>

      <GateScene state={gate} />

      {expired ? (
        <View style={styles.card}>
          <Icon name="timer-sand-empty" size={ICON_SIZES.xxl} color={COLORS.emberLight} />
          <Text style={styles.cardTitle}>{i18n.t('verify_expired_title')}</Text>
          <Text style={styles.instruction}>{i18n.t('verify_expired_body')}</Text>
          <GameButton variant="primary" onPress={restart}>{i18n.t('verify_start_over')}</GameButton>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            {/* verify.mn's own copy — it names the SIM the SMS must come from, which is the
                single most common reason a verification fails. Shown verbatim. */}
            <Text style={styles.instruction}>{displayInstruction}</Text>
            {!!code && (
              <Text style={styles.manual}>
                {i18n.t('verify_sms_manual', { code, shortcode: shortcode ?? '144773' })}
              </Text>
            )}
          </View>

          <GameButton variant="primary" icon="message-text" onPress={openSmsApp} disabled={loading}>
            {i18n.t('verify_sms_open')}
          </GameButton>
          {openFailed && <Text style={styles.error}>{i18n.t('verify_open_sms_failed')}</Text>}

          <View style={styles.waitingRow}>
            <ActivityIndicator color={COLORS.gold} size="small" />
            <Text style={styles.waiting}>
              {loading ? i18n.t('verify_sms_sent') : i18n.t('verify_sms_waiting')}
            </Text>
          </View>

          <Text style={styles.meta}>{i18n.t('verify_expires_in', { time: mmss })}</Text>
          <Text style={styles.meta}>{i18n.t('verify_sms_cost')}</Text>
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <GameButton variant="ghost" size="compact" onPress={restart}>{i18n.t('back')}</GameButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xxl, gap: SPACE.lg },
  title: {
    fontSize: FONT_SIZES.display,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: FONTS.display,
  },
  phone: { fontSize: FONT_SIZES.lg, color: COLORS.textDim, textAlign: 'center', fontFamily: FONTS.body },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: LINE.edge,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    gap: SPACE.md,
    alignItems: 'center',
  },
  cardTitle: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.text, textAlign: 'center' },
  instruction: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: LINE_HEIGHTS.lg,
  },
  manual: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'center' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  waiting: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  meta: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'center' },
  error: { color: COLORS.emberLight, fontSize: FONT_SIZES.md, textAlign: 'center', fontFamily: FONTS.body },
});
