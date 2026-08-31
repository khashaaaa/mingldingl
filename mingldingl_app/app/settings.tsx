import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Input, YStack, XStack } from 'tamagui';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api/apiClient';
import { parseUserProfile } from '../models/user';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, RADIUS } from '../lib/theme';
import { AlertModal } from '../components/modals/AlertModal';
import { ChoiceRow } from '../components/ui/ChoiceRow';
import { GameButton } from '../components/ui/GameButton';
import { TiledBackdrop } from '../components/ui/TiledBackdrop';
import { ScreenHeader } from '../components/ui/ScreenHeader';

const DUNGEON_WALL_ASSET = require('../assets/textures/dungeon_wall.png');

const LANGUAGE_OPTIONS = ['en', 'mn'] as const;
const NOTIF_OPTIONS = ['on', 'off'] as const;
const PAUSE_OPTIONS = ['off', 'on'] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletedAlert, setDeletedAlert] = useState(false);

  const [ageMinInput, setAgeMinInput] = useState(String(profile?.ageMin ?? 18));
  const [ageMaxInput, setAgeMaxInput] = useState(String(profile?.ageMax ?? 99));
  const [ageRangeError, setAgeRangeError] = useState(false);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    setAgeMinInput(String(profile.ageMin ?? 18));
    setAgeMaxInput(String(profile.ageMax ?? 99));
  }, [profile]);

  const [changingPhone, setChangingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [saveFailedAlert, setSaveFailedAlert] = useState(false);

  async function handlePickLanguage(lang: (typeof LANGUAGE_OPTIONS)[number]) {
    await setLocale(lang);
  }

  async function handleToggleNotifications(next: (typeof NOTIF_OPTIONS)[number]) {
    try {
      const updated = await apiClient.users.update({ pushEnabled: next === 'on' });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
    } catch {
      setSaveFailedAlert(true);
    }
  }

  async function handleTogglePause(next: (typeof PAUSE_OPTIONS)[number]) {
    try {
      const updated = await apiClient.users.update({ isPaused: next === 'on' });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
    } catch {
      setSaveFailedAlert(true);
    }
  }

  async function handleSaveAgeRange() {
    const min = Number(ageMinInput);
    const max = Number(ageMaxInput);
    if (!min || !max || min > max) {
      setAgeRangeError(true);
      return;
    }
    setAgeRangeError(false);
    try {
      const updated = await apiClient.users.update({ ageMin: min, ageMax: max });
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
    } catch {
      setSaveFailedAlert(true);
    }
  }

  async function handleSavePhone() {
    setSavingPhone(true);
    setPhoneError(false);
    try {
      const updated = await apiClient.users.changePhone(newPhone);
      queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
      setChangingPhone(false);
      setNewPhone('');
    } catch {
      setPhoneError(true);
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await apiClient.users.requestDeletion();
      setConfirmDelete(false);
      setDeletedAlert(true);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAcknowledgeDeletion() {
    setDeletedAlert(false);
    await signOut();
  }

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScreenHeader title={i18n.t('settings_title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <ChoiceRow
          label={i18n.t('language')}
          value={(locale === 'mn' ? 'mn' : 'en') as (typeof LANGUAGE_OPTIONS)[number]}
          options={LANGUAGE_OPTIONS}
          optionLabel={(opt) => i18n.t(opt === 'en' ? 'language_english' : 'language_mongolian')}
          onChange={handlePickLanguage}
          size="compact"
          unselectedVariant="brass"
        />
        <ChoiceRow
          label={i18n.t('notifications')}
          value={(profile?.pushEnabled ?? true) ? 'on' : 'off'}
          options={NOTIF_OPTIONS}
          optionLabel={(opt) => i18n.t(opt === 'on' ? 'notif_on' : 'notif_off')}
          onChange={handleToggleNotifications}
          size="compact"
          unselectedVariant="brass"
        />

        <YStack gap="$2">
          <Text style={styles.sectionLabel}>{i18n.t('match_preferences')}</Text>
          <Text style={styles.sectionHint}>{i18n.t('age_range')}</Text>
          <XStack gap="$3" alignItems="center">
            <YStack gap="$1" flex={1}>
              <Text style={styles.fieldLabel}>{i18n.t('age_min_label')}</Text>
              <Input
                value={ageMinInput} onChangeText={setAgeMinInput}
                keyboardType="number-pad" maxLength={2}
                backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
                fontFamily={FONTS.body as any}
              />
            </YStack>
            <YStack gap="$1" flex={1}>
              <Text style={styles.fieldLabel}>{i18n.t('age_max_label')}</Text>
              <Input
                value={ageMaxInput} onChangeText={setAgeMaxInput}
                keyboardType="number-pad" maxLength={2}
                backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
                fontFamily={FONTS.body as any}
              />
            </YStack>
          </XStack>
          {ageRangeError && <Text style={styles.errorText}>{i18n.t('age_range_invalid')}</Text>}
          <GameButton variant="brass" size="compact" onPress={handleSaveAgeRange}>{i18n.t('save')}</GameButton>
        </YStack>

        <YStack gap="$2">
          <ChoiceRow
            label={i18n.t('pause_profile')}
            value={(profile?.isPaused ? 'on' : 'off') as (typeof PAUSE_OPTIONS)[number]}
            options={PAUSE_OPTIONS}
            optionLabel={(opt) => i18n.t(opt === 'on' ? 'pause_on' : 'pause_off')}
            onChange={handleTogglePause}
            size="compact"
            unselectedVariant="brass"
          />
          <Text style={styles.sectionHint}>{i18n.t('pause_profile_hint')}</Text>
        </YStack>

        <GameButton variant="brass" size="compact" icon="account-off-outline" onPress={() => router.push('/blocked-users')}>
          {i18n.t('view_blocked_users')}
        </GameButton>

        <GameButton variant="brass" size="compact" icon="crown-outline" onPress={() => router.push('/membership')}>
          {i18n.t('manage_membership')}
        </GameButton>

        <YStack gap="$2">
          <Text style={styles.sectionLabel}>{i18n.t('help_and_legal')}</Text>
          <GameButton variant="brass" size="compact" icon="book-open-variant" onPress={() => router.push('/guides')}>
            {i18n.t('guides')}
          </GameButton>
          <GameButton variant="brass" size="compact" icon="file-document-outline" onPress={() => router.push('/terms')}>
            {i18n.t('terms_of_service')}
          </GameButton>
          <GameButton variant="brass" size="compact" icon="shield-lock-outline" onPress={() => router.push('/privacy')}>
            {i18n.t('privacy_policy')}
          </GameButton>
        </YStack>

        <YStack gap="$2">
          <Text style={styles.sectionLabel}>{i18n.t('phone_number')}</Text>
          <Text style={styles.sectionHint}>{profile?.phoneNumber ?? '—'}</Text>
          <GameButton variant="brass" size="compact" icon="phone-outline" onPress={() => setChangingPhone(true)}>
            {i18n.t('change_phone')}
          </GameButton>
        </YStack>

        <View style={styles.dangerWrap}>
          <GameButton variant="danger" size="compact" icon="account-remove" onPress={() => setConfirmDelete(true)}>
            {i18n.t('delete_account')}
          </GameButton>
        </View>
        <View style={styles.signOutWrap}>
          <GameButton variant="brass" size="compact" icon="skull-crossbones" onPress={signOut}>{i18n.t('sign_out')}</GameButton>
        </View>
      </ScrollView>

      <AlertModal
        visible={confirmDelete}
        tone="warning"
        title={i18n.t('delete_account_confirm_title')}
        message={i18n.t('delete_account_confirm_body')}
        confirmLabel={i18n.t('delete_account')}
        onConfirm={handleDeleteConfirmed}
        isConfirming={deleting}
        onDismiss={() => setConfirmDelete(false)}
      />
      <AlertModal
        visible={deletedAlert}
        tone="warning"
        title={i18n.t('delete_account_requested_title')}
        message={i18n.t('delete_account_requested_body')}
        onDismiss={handleAcknowledgeDeletion}
      />
      <AlertModal
        visible={changingPhone}
        title={i18n.t('change_phone_title')}
        message={phoneError ? i18n.t('phone_change_error') : ''}
        tone={phoneError ? 'warning' : 'default'}
        confirmLabel={i18n.t('save')}
        isConfirming={savingPhone}
        onConfirm={handleSavePhone}
        onDismiss={() => { setChangingPhone(false); setNewPhone(''); setPhoneError(false); }}
      >
        <Input
          value={newPhone} onChangeText={setNewPhone}
          placeholder={i18n.t('new_phone_placeholder')} keyboardType="number-pad" maxLength={8}
          placeholderTextColor={COLORS.textDim as any}
          backgroundColor={COLORS.panel} borderColor={COLORS.bronze} color={COLORS.text}
          fontFamily={FONTS.body as any}
        />
      </AlertModal>
      <AlertModal
        visible={saveFailedAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setSaveFailedAlert(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 24 },
  sectionLabel: { color: COLORS.gold, fontFamily: FONTS.bodyBold, fontSize: 14 },
  sectionHint: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 12, lineHeight: 17 },
  fieldLabel: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: 12 },
  errorText: { color: COLORS.emberLight, fontFamily: FONTS.body, fontSize: 12 },
  dangerWrap: { marginTop: 16 },
  signOutWrap: { marginTop: 4 },
});
