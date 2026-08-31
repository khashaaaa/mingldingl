import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { isPhoneValid, useAuth } from '../../hooks/useAuth';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { GameButton } from '../../components/ui/GameButton';
import { DismissKeyboardView } from '../../components/ui/DismissKeyboardView';
import { GlowText } from '../../components/vfx/GlowText';
import { EmberField } from '../../components/vfx/EmberField';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export default function PhoneScreen() {
  useLocaleStore((s) => s.locale);
  const [phone, setPhone] = useState('');
  const { sendOtp, loading, error } = useAuth();
  const router = useRouter();
  const [screenSize, setScreenSize] = useState({ w: 0, h: 0 });

  function onContainerLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setScreenSize({ w: width, h: height });
  }

  async function handleSend() {
    Keyboard.dismiss();
    if (!isPhoneValid(phone)) return;
    const ok = await sendOtp(phone);
    if (ok) router.push({ pathname: '/(auth)/otp', params: { phone } });
  }

  return (
    <DismissKeyboardView>
      <KeyboardAvoidingView
        style={styles.container}
        onLayout={onContainerLayout}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {screenSize.w > 0 && <EmberField width={screenSize.w} height={screenSize.h} density={10} />}
        <View style={styles.inner}>
          <GlowText style={styles.logo}>MINGLDINGL</GlowText>
          <Text style={styles.subtitle}>{i18n.t('enter_the_realm')}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>{i18n.t('your_phone_number')}</Text>
          <View style={styles.inputRow}>
            <View style={styles.prefixBadge}>
              <Text style={styles.prefixText}>+976</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={i18n.t('phone_placeholder')}
              placeholderTextColor={COLORS.textDim}
              keyboardType="phone-pad"
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
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
    backgroundColor: COLORS.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  logo: {
    fontSize: 40,
    color: COLORS.gold,
    textAlign: 'center',
    letterSpacing: 0,
    fontFamily: FONTS.wordmark,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textDim,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: FONTS.body,
  },
  divider: {
    height: 24,
  },
  label: {
    fontSize: 13,
    color: COLORS.textDim,
    letterSpacing: 0.3,
    marginBottom: 4,
    fontFamily: FONTS.body,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  prefixBadge: {
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: COLORS.panel,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    color: COLORS.gold,
    fontSize: 16,
    fontFamily: FONTS.bodyBold,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: COLORS.panel,
    borderWidth: 1.5,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.body,
  },
  error: {
    color: COLORS.emberLight,
    fontSize: 14,
    marginBottom: 4,
    fontFamily: FONTS.body,
  },
});
