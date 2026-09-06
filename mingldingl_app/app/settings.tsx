import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { COLORS, FONTS, FONT_SIZES, LINE_HEIGHTS, SPACE } from '../lib/theme';
import { AlertModal } from '../components/modals/AlertModal';
import { PhoneChangeModal } from '../components/settings/PhoneChangeModal';
import { ChoiceRow } from '../components/ui/ChoiceRow';
import { useSoundStore } from '../store/soundStore';
import { GameButton } from '../components/ui/GameButton';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionDivider } from '../components/ui/SectionDivider';
import { TextField } from '../components/ui/TextField';
import { useScrollTail } from '../hooks/useScrollTail';


const LANGUAGE_OPTIONS = ['en', 'mn'] as const;
const NOTIF_OPTIONS = ['on', 'off'] as const;
const PAUSE_OPTIONS = ['off', 'on'] as const;

export default function SettingsScreen() {
  const tail = useScrollTail();
  const soundEnabled = useSoundStore((st) => st.enabled);
  const setSoundEnabled = useSoundStore((st) => st.set);
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const deletionGraceDays = profile?.deletionGraceDays ?? 7;
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
  const [saveFailedAlert, setSaveFailedAlert] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  async function handlePickLanguage(lang: (typeof LANGUAGE_OPTIONS)[number]) {
    await setLocale(lang);
  }

  async function handleToggleNotifications(next: (typeof NOTIF_OPTIONS)[number]) {
    try {
      await updateProfile.mutateAsync({ pushEnabled: next === 'on' });
    } catch {
      setSaveFailedAlert(true);
    }
  }

  async function handleTogglePause(next: (typeof PAUSE_OPTIONS)[number]) {
    try {
      await updateProfile.mutateAsync({ isPaused: next === 'on' });
    } catch {
      setSaveFailedAlert(true);
    }
  }

  const [ageRangeMessage, setAgeRangeMessage] = useState<string | null>(null);

  async function handleSaveAgeRange() {
    const min = Number(ageMinInput);
    const max = Number(ageMaxInput);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      setAgeRangeMessage(i18n.t('age_range_invalid'));
      return;
    }
    if (min < 18) {
      setAgeRangeMessage(i18n.t('age_min_too_low'));
      return;
    }
    if (max > 99) {
      setAgeRangeMessage(i18n.t('age_max_too_high'));
      return;
    }
    setAgeRangeMessage(null);
    try {
      await updateProfile.mutateAsync({ ageMin: min, ageMax: max });
      setSavedNotice(true);
    } catch {
      setSaveFailedAlert(true);
    }
  }

  function handlePhoneChanged() {
    setChangingPhone(false);
    setSavedNotice(true);
    queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await apiClient.users.requestDeletion();
      setConfirmDelete(false);
      setDeletedAlert(true);
    } catch {
      setConfirmDelete(false);
      setSaveFailedAlert(true);
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
      <ScreenHeader title={i18n.t('settings_title')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        <ChoiceRow
          label={i18n.t('language')}
          value={(locale === 'mn' ? 'mn' : 'en') as (typeof LANGUAGE_OPTIONS)[number]}
          options={LANGUAGE_OPTIONS}
          optionLabel={(opt) => i18n.t(opt === 'en' ? 'language_english' : 'language_mongolian')}
          onChange={handlePickLanguage}
          size="compact"
        />
        <ChoiceRow
          label={i18n.t('notifications')}
          value={(profile?.pushEnabled ?? true) ? 'on' : 'off'}
          options={NOTIF_OPTIONS}
          optionLabel={(opt) => i18n.t(opt === 'on' ? 'notif_on' : 'notif_off')}
          onChange={handleToggleNotifications}
          size="compact"
        />
        <ChoiceRow
          label={i18n.t('sound')}
          value={soundEnabled ? 'on' : 'off'}
          options={NOTIF_OPTIONS}
          optionLabel={(opt) => i18n.t(opt === 'on' ? 'sound_on' : 'sound_off')}
          onChange={(opt) => setSoundEnabled(opt === 'on')}
          size="compact"
        />

        <SectionDivider />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{i18n.t('match_preferences')}</Text>
          <Text style={styles.sectionHint}>{i18n.t('age_range')}</Text>
          <View style={styles.ageRow}>
            <View style={styles.ageField}>
              <Text style={styles.fieldLabel}>{i18n.t('age_min_label')}</Text>
              <TextField
                value={ageMinInput} onChangeText={setAgeMinInput}
                keyboardType="number-pad" maxLength={2}
              />
            </View>
            <View style={styles.ageField}>
              <Text style={styles.fieldLabel}>{i18n.t('age_max_label')}</Text>
              <TextField
                value={ageMaxInput} onChangeText={setAgeMaxInput}
                keyboardType="number-pad" maxLength={2}
              />
            </View>
          </View>
          {!!ageRangeMessage && <Text style={styles.errorText}>{ageRangeMessage}</Text>}
          <GameButton variant="brass" size="compact" onPress={handleSaveAgeRange}>{i18n.t('save')}</GameButton>
        </View>

        <View style={styles.section}>
          <ChoiceRow
            label={i18n.t('pause_profile')}
            value={(profile?.isPaused ? 'on' : 'off') as (typeof PAUSE_OPTIONS)[number]}
            options={PAUSE_OPTIONS}
            optionLabel={(opt) => i18n.t(opt === 'on' ? 'pause_on' : 'pause_off')}
            onChange={handleTogglePause}
            size="compact"
          />
          <Text style={styles.sectionHint}>{i18n.t('pause_profile_hint')}</Text>
        </View>

        <GameButton variant="brass" size="compact" icon="account-off-outline" onPress={() => router.push('/blocked-users')}>
          {i18n.t('view_blocked_users')}
        </GameButton>

        <GameButton variant="brass" size="compact" icon="crown-outline" onPress={() => router.push('/membership')}>
          {i18n.t('manage_membership')}
        </GameButton>

        <SectionDivider />
        <View style={styles.section}>
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
        </View>

        <SectionDivider />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{i18n.t('phone_number')}</Text>
          <Text style={styles.sectionHint}>{profile?.phoneNumber ?? '—'}</Text>
          <GameButton variant="brass" size="compact" icon="phone-outline" onPress={() => setChangingPhone(true)}>
            {i18n.t('change_phone')}
          </GameButton>
        </View>

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
        message={i18n.t('delete_account_confirm_body', { days: deletionGraceDays })}
        confirmLabel={i18n.t('delete_account')}
        onConfirm={handleDeleteConfirmed}
        isConfirming={deleting}
        onDismiss={() => setConfirmDelete(false)}
      />
      <AlertModal
        visible={deletedAlert}
        tone="warning"
        title={i18n.t('delete_account_requested_title')}
        message={i18n.t('delete_account_requested_body', { days: deletionGraceDays })}
        onDismiss={handleAcknowledgeDeletion}
      />
      <PhoneChangeModal
        visible={changingPhone}
        onDismiss={() => setChangingPhone(false)}
        onChanged={handlePhoneChanged}
      />
      <AlertModal
        visible={savedNotice}
        title={i18n.t('settings_saved')}
        onDismiss={() => setSavedNotice(false)}
      />
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
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: SPACE.xl, gap: SPACE.xxl },
  section: { gap: SPACE.sm },
  ageRow: { flexDirection: 'row', gap: SPACE.md, alignItems: 'center' },
  ageField: { gap: SPACE.hair, flex: 1 },
  sectionLabel: { color: COLORS.gold, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.md },
  sectionHint: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, lineHeight: LINE_HEIGHTS.sm },
  fieldLabel: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  errorText: { color: COLORS.emberLight, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm },
  dangerWrap: { marginTop: SPACE.lg },
  signOutWrap: { marginTop: SPACE.xs },
});
