import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { GameButton } from '../../components/ui/GameButton';
import { DismissKeyboardView } from '../../components/ui/DismissKeyboardView';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export default function OtpScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const { verifyOtp, loading, error } = useAuth();
  const router = useRouter();

  // Reaching this screen without a phone param (deep link, back-navigation
  // quirk) would otherwise render "+976 undefined" and verifyOtp(undefined,
  // code) would silently no-op the phone-linking step — send the user back
  // to re-enter it instead.
  useEffect(() => {
    if (!phone) router.replace('/(auth)/phone');
  }, [phone]);

  async function handleVerify() {
    Keyboard.dismiss();
    await verifyOtp(phone, code);
  }

  if (!phone) return null;

  return (
    <DismissKeyboardView>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>{i18n.t('verify_title')}</Text>
          <Text style={styles.phone}>+976 {phone}</Text>
          <TextInput
            style={styles.otpInput}
            value={code}
            onChangeText={(t) => { setCode(t); if (t.length === 6) Keyboard.dismiss(); }}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
            placeholder="------"
            placeholderTextColor={COLORS.bronze}
            textAlign="center"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <GameButton
            variant="primary"
            onPress={handleVerify}
            disabled={code.length !== 6 || loading}
            loading={loading}
          >
            {i18n.t('verify_button')}
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
    gap: 16,
  },
  title: {
    fontSize: 32,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: FONTS.display,
  },
  phone: {
    fontSize: 16,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  otpInput: {
    height: 64,
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: FONTS.body,
  },
  error: {
    color: COLORS.ember,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: FONTS.body,
  },
});
