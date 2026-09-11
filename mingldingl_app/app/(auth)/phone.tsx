import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isPhoneValid, useAuth } from '../../hooks/useAuth';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { GameButton } from '../../components/ui/GameButton';
import { TextField } from '../../components/ui/TextField';
import { DismissKeyboardView } from '../../components/ui/DismissKeyboardView';
import { GlowText } from '../../components/vfx/GlowText';
import { EmberField } from '../../components/vfx/EmberField';
import { SectionDivider } from '../../components/ui/SectionDivider';
import { ACCENT, FONTS, FONT_SIZES, INK, RADIUS, SPACE, SURFACE, TRACKING } from '../../lib/theme';
import { FieldError } from '../../components/ui/StateBlock';
export default function PhoneScreen() {
  useLocaleStore((s) => s.locale);
  const [phone, setPhone] = useState('');
  const { startPhoneVerification, loading, error, clearError } = useAuth();
  const router = useRouter();
  const [screenSize, setScreenSize] = useState({ w: 0, h: 0 });
  const insets = useSafeAreaInsets();

  function onContainerLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setScreenSize({ w: width, h: height });
  }

  async function handleSend() {
    Keyboard.dismiss();
    if (!isPhoneValid(phone) || loading) return;
    const verification = await startPhoneVerification(phone);
    if (!verification) return;
    router.push({
      pathname: '/(auth)/otp',
      params: {
        phone,
        verificationId: verification.verificationId,
        smsUri: verification.smsUri,
        code: verification.code,
        displayInstruction: verification.displayInstruction,
        shortcode: verification.shortcode,
        expiresAt: verification.expiresAt,
      },
    });
  }

  return (
    <DismissKeyboardView>
      <KeyboardAvoidingView
        style={styles.container}
        onLayout={onContainerLayout}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // Measured relative to its parent, so the offset is that parent's screen-space origin —
        // the root SafeAreaView's top edge.
        keyboardVerticalOffset={insets.top}
      >
        {screenSize.w > 0 && <EmberField width={screenSize.w} height={screenSize.h} density={10} />}
        <View style={styles.inner}>
          <GlowText style={styles.logo}>MINGLDINGL</GlowText>
          <Text style={styles.subtitle}>{i18n.t('enter_the_realm')}</Text>
          <View style={styles.divider}><SectionDivider tint={ACCENT.base} /></View>
          <Text style={styles.label}>{i18n.t('your_phone_number')}</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefixBadge}>
              <Text style={styles.prefixText}>+976</Text>
            </View>
            <TextField
              style={styles.input}
              value={phone}
              onChangeText={(t) => { setPhone(t); if (error) clearError(); }}
              autoFocus
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder={i18n.t('phone_placeholder')}
              keyboardType="phone-pad"
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />
          </View>
          {!!error && <FieldError style={styles.error}>{error}</FieldError>}
          <GameButton
            variant="primary"
            onPress={handleSend}
            disabled={!isPhoneValid(phone) || loading}
            loading={loading}
          >
            {i18n.t('continue_btn')}
          </GameButton>
        </View>
      </KeyboardAvoidingView>
    </DismissKeyboardView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xxxl,
    gap: SPACE.md,
  },
  logo: {
    fontSize: FONT_SIZES.wordmark,
    color: ACCENT.base,
    textAlign: 'center',
    letterSpacing: TRACKING.none,
    fontFamily: FONTS.wordmark,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: INK.dim,
    textAlign: 'center',
    letterSpacing: TRACKING.label,
    fontFamily: FONTS.body,
  },
  divider: {
    alignSelf: 'stretch',
    marginVertical: SPACE.xs,
  },
  label: {
    fontSize: FONT_SIZES.md,
    color: INK.dim,
    letterSpacing: TRACKING.body,
    marginBottom: SPACE.xs,
    fontFamily: FONTS.body,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.xs,
  },
  prefixBadge: {
    height: 52,
    paddingHorizontal: SPACE.lg,
    backgroundColor: SURFACE.panel,
    borderWidth: 1,
    borderColor: ACCENT.base,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    color: ACCENT.base,
    fontSize: FONT_SIZES.lg,
    fontFamily: FONTS.bodyBold,
  },
  input: { flex: 1 },
  error: { marginBottom: SPACE.xs },
});
