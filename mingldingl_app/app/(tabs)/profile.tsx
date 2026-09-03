import { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import { useProfile } from '../../hooks/useProfile';
import { useScoreDetail } from '../../hooks/useScoreDetail';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { parseUserProfile } from '../../models/user';
import { colorForTier, itemLabel, membershipLabel, FRAME_COLORS } from '../../lib/tiers';
import { AlertModal } from '../../components/modals/AlertModal';
import { AppCard } from '../../components/ui/AppCard';
import { GameButton } from '../../components/ui/GameButton';
import { GameHeader } from '../../components/ui/GameHeader';
import { SectionDivider } from '../../components/ui/SectionDivider';
import { XPBar } from '../../components/progression/XPBar';
import { GemTierBadge } from '../../components/progression/GemTierBadge';
import { InviteAllyCard } from '../../components/progression/InviteAllyCard';
import { ThreadLog } from '../../components/progression/ThreadLog';
import { Icon } from '../../components/ui/Icon';
import { NextActionCard } from '../../components/NextActionCard';
import { ShareCharacterButton } from '../../components/cards/ShareCharacterButton';
import { TrophyCase } from '../../components/progression/TrophyCase';
import { useInventory } from '../../hooks/useInventory';
import { TorchGlow } from '../../components/vfx/TorchGlow';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import OathSigil, { OATH_VALUES, OATH_SIGILS, OATH_NAME_KEYS, OATH_DESC_KEYS } from '../../components/OathSigil';
import { useSwearOath } from '../../hooks/useOath';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE, circle, overlay } from '../../lib/theme';
import type { GemTier, Oath } from '../../models/user';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ProfileScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: scoreDetail } = useScoreDetail();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const [photoError, setPhotoError] = useState(false);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [oathModalVisible, setOathModalVisible] = useState(false);
  const pendingSourceActionRef = useRef<(() => void) | null>(null);
  const { pickPhoto, takePhoto, uploadPhoto, uploading, permissionDenied, clearPermissionDenied } = usePhotoUpload(session?.user.id);
  const { items } = useInventory();
  const { swear, isSwearing, swearError } = useSwearOath();
  const [showOathError, setShowOathError] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (swearError) setShowOathError(true);
  }, [swearError]);

  function handleSwear(oath: Oath) {
    setOathModalVisible(false);
    swear(oath);
  }

  if (!profile || !scoreDetail) {
    return (
      <View style={styles.loadingScreen}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} />
        <Spinner color="$gold" />
      </View>
    );
  }

  const gemTier = (scoreDetail.gemTier as GemTier) ?? 'Garnet';
  const nextTier = scoreDetail.nextTier as GemTier | null;
  const firstPhoto = profile.photoUrls?.[0];
  const showPhoto = !!firstPhoto && !photoError;
  const tierColor = colorForTier(gemTier);
  const frameColor = (profile.equippedFrameId && FRAME_COLORS[profile.equippedFrameId]) ?? tierColor;

  function closeSourceModalThen(action: () => void) {
    if (Platform.OS === 'ios') {
      pendingSourceActionRef.current = action;
      setSourceModalVisible(false);
    } else {
      setSourceModalVisible(false);
      action();
    }
  }

  async function handleAddFrom(picker: () => Promise<string | null>) {
    const localUri = await picker();
    if (!localUri || !profile) return;
    if (mountedRef.current) setPhotoError(false);
    type Profile = NonNullable<typeof profile>;

    queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
      prev ? { ...prev, photoUrls: [localUri, ...(prev.photoUrls ?? []).slice(1)] } : prev);
    const publicUrl = await uploadPhoto(localUri);
    if (publicUrl) {
      try {
        const cached = queryClient.getQueryData<Profile>(queryKeys.userProfile);
        const nextPhotoUrls = (cached?.photoUrls ?? []).map((u) => (u === localUri ? publicUrl : u));
        if (!nextPhotoUrls.includes(publicUrl)) nextPhotoUrls.unshift(publicUrl);
        const updated = await apiClient.users.update({ photoUrls: nextPhotoUrls });
        queryClient.setQueryData(queryKeys.userProfile, parseUserProfile(updated));
      } catch {
        queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
          prev ? { ...prev, photoUrls: (prev.photoUrls ?? []).filter((u) => u !== localUri) } : prev);
        if (mountedRef.current) setUploadFailedAlert(true);
      }
    } else {
      queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
        prev ? { ...prev, photoUrls: (prev.photoUrls ?? []).filter((u) => u !== localUri) } : prev);
      if (mountedRef.current) setUploadFailedAlert(true);
    }
  }

  return (
    <View style={styles.screen}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameHeader title={i18n.t('character_sheet')} icon="shield-sword" />

      <TouchableOpacity
        style={styles.avatarTouchable}
        onPress={() => setSourceModalVisible(true)}
        disabled={uploading}
        accessibilityLabel={i18n.t('change_avatar')}
      >
        <TorchGlow size={118} color={tierColor}>
          <View style={styles.avatarFrame}>
            <View style={[styles.avatarFrameRotated, { borderColor: frameColor }]} />
            <View style={[styles.avatarRing, { borderColor: frameColor, shadowColor: tierColor }]}>
              <View style={styles.avatarClip}>
                {showPhoto ? (
                  <Image
                    source={{ uri: firstPhoto }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="camera" size={36} color={COLORS.gold} />
                  </View>
                )}
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color={tierColor} />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.avatarEditBadge}>
              <Icon name="pencil" size={13} color={COLORS.bg} />
            </View>
          </View>
        </TorchGlow>
      </TouchableOpacity>

      <Modal
        visible={sourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceModalVisible(false)}
        onDismiss={() => {
          const action = pendingSourceActionRef.current;
          pendingSourceActionRef.current = null;
          action?.();
        }}
      >
        <View style={styles.sourceOverlay}>
          <View style={styles.sourceSheet}>
            <GameButton
              variant="brass"
              size="compact"
              icon="image-multiple"
              onPress={() => closeSourceModalThen(async () => handleAddFrom(async () => (await pickPhoto(1))[0] ?? null))}
            >
              {i18n.t('pick_from_library')}
            </GameButton>
            {Platform.OS !== 'web' && (
              <GameButton
                variant="brass"
                size="compact"
                icon="camera-plus"
                onPress={() => closeSourceModalThen(async () => handleAddFrom(takePhoto))}
              >
                {i18n.t('take_photo')}
              </GameButton>
            )}
            <GameButton variant="brass" size="compact" onPress={() => setSourceModalVisible(false)}>
              {i18n.t('back')}
            </GameButton>
          </View>
        </View>
      </Modal>

      <View style={styles.nameRow}>
        <View style={styles.nameBlock}>
          <Text style={styles.displayName}>{profile.displayName}</Text>
          {profile.equippedTitleId && (
            <Text style={styles.equippedTitle}>{itemLabel(profile.equippedTitleId)}</Text>
          )}
          <Text style={styles.subText}>{profile.age} · {profile.city}</Text>
        </View>
        <GemTierBadge tier={gemTier} size={44} glow />
      </View>

      <NextActionCard />

      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push('/progression')}>
        <AppCard tier={gemTier} textured style={{ padding: SPACE.lg }}>
          <XPBar
            gemTier={gemTier}
            totalScore={scoreDetail.totalScore ?? 0}
            pct={(scoreDetail.progressPct ?? 0) / 100}
            nextTier={nextTier}
          />
        </AppCard>
      </TouchableOpacity>

      <AppCard tier={gemTier} textured style={[styles.card, styles.cardPadding]}>
        <Text style={styles.cardLabel}>{i18n.t('total_score')}</Text>
        <Text style={styles.scoreValue}>{(scoreDetail.totalScore ?? 0).toLocaleString()} {i18n.t('pts')}</Text>
        <SectionDivider />
        <TouchableOpacity onPress={() => router.push('/membership')}>
          <Text style={styles.cardLabel}>{i18n.t('guild_rank').toUpperCase()}</Text>
          <View style={styles.membershipRow}>
            <Text style={styles.membershipValue}>{membershipLabel(profile.membershipLevel)}</Text>
            <Text style={styles.membershipArrow}>→</Text>
          </View>
        </TouchableOpacity>
      </AppCard>

      <TouchableOpacity activeOpacity={0.85} onPress={() => setOathModalVisible(true)}>
        <AppCard tier={gemTier} textured style={[styles.card, styles.cardPadding]}>
          <Text style={styles.cardLabel}>{i18n.t('oath_title').toUpperCase()}</Text>
          {profile.oath ? (
            <View style={styles.oathRow}>
              <OathSigil
                oath={profile.oath}
                proven={profile.oathProven}
                size="md"
                progress={
                  profile.oathEncountersHeld != null && profile.oathEncountersNeeded != null
                    ? { held: profile.oathEncountersHeld, needed: profile.oathEncountersNeeded }
                    : null
                }
              />
            </View>
          ) : (
            <Text style={styles.oathPrompt}>{i18n.t('oath_prompt_banner')}</Text>
          )}
        </AppCard>
      </TouchableOpacity>

      <AppCard style={[styles.card, styles.cardPadding]}>
        <Text style={styles.cardLabel}>{i18n.t('bio')}</Text>
        <Text style={styles.bioText}>{profile.bio}</Text>
      </AppCard>

      <InviteAllyCard referralCode={profile.referralCode} />

      <ThreadLog ownedItemIds={items.map((i) => i.itemId ?? '')} />

      <TrophyCase />

      <View style={styles.editButtonWrapper}>
        <GameButton variant="brass" size="compact" icon="book-heart" onPress={() => router.push('/date-log')}>
          {i18n.t('view_date_log')}
        </GameButton>
      </View>

      <View style={styles.editButtonWrapper}>
        <GameButton variant="brass" size="compact" onPress={() => router.push('/edit-profile')}>
          {i18n.t('edit_profile')}
        </GameButton>
      </View>

      <View style={styles.editButtonWrapper}>
        <ShareCharacterButton
          displayName={profile.displayName}
          photoUrl={firstPhoto}
          gemTier={gemTier}
          totalScore={scoreDetail.totalScore ?? 0}
          currentStreak={scoreDetail.currentStreak ?? 0}
        />
      </View>

      <View style={styles.signOutWrapper}>
        <GameButton variant="brass" size="compact" icon="cog-outline" onPress={() => router.push('/settings')}>
          {i18n.t('settings_title')}
        </GameButton>
      </View>
      </ScrollView>
      <AlertModal
        visible={uploadFailedAlert}
        tone="warning"
        title={i18n.t('photo_upload_failed_title')}
        message={i18n.t('photo_upload_failed_body')}
        onDismiss={() => setUploadFailedAlert(false)}
      />
      <AlertModal
        visible={permissionDenied}
        tone="warning"
        title={i18n.t('photo_permission_denied_title')}
        message={i18n.t('photo_permission_denied_body')}
        onDismiss={clearPermissionDenied}
      />
      <AlertModal
        visible={showOathError}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setShowOathError(false)}
      />
      <Modal
        visible={oathModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOathModalVisible(false)}
      >
        <View style={styles.sourceOverlay}>
          <View style={styles.oathSheet}>
            <Text style={styles.oathSheetTitle}>{i18n.t('oath_step_heading')}</Text>
            {OATH_VALUES.map((oath) => {
              const isCurrent = profile.oath === oath;
              return (
                <TouchableOpacity
                  key={oath}
                  activeOpacity={0.85}
                  disabled={isSwearing}

                  onPress={() => (isCurrent ? setOathModalVisible(false) : handleSwear(oath))}
                  style={[styles.oathOption, isCurrent && styles.oathOptionCurrent]}
                >
                  <Image
                    source={OATH_SIGILS[oath]}
                    style={[styles.oathOptionSigil, !isCurrent && styles.oathOptionSigilDim]}
                  />
                  <View style={styles.oathOptionText}>
                    <Text style={styles.oathOptionName}>{i18n.t(OATH_NAME_KEYS[oath])}</Text>
                    <Text style={styles.oathOptionDesc}>{i18n.t(OATH_DESC_KEYS[oath])}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.oathSheetHelp}>{i18n.t('oath_step_help')}</Text>
            <GameButton variant="brass" size="compact" onPress={() => setOathModalVisible(false)}>
              {i18n.t('back')}
            </GameButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: SPACE.scrollTail },
  avatarTouchable: { alignSelf: 'center', marginTop: SPACE.sm, marginBottom: SPACE.xl },
  avatarFrame: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  avatarFrameRotated: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    transform: [{ rotate: '45deg' }],
    opacity: 0.5,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: RADIUS.lg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarClip: {
    ...circle(100),
    overflow: 'hidden',
    backgroundColor: COLORS.panelRaised,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    ...circle(26),
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceOverlay: { flex: 1, backgroundColor: overlay(0.88), alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  sourceSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  avatarImage: { width: 100, height: 100 },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: overlay(0.55),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.gutter,
    marginBottom: SPACE.xl,
  },
  nameBlock: { flex: 1 },
  displayName: {
    fontSize: FONT_SIZES.title,
    fontFamily: FONTS.display,
    color: COLORS.text,
    marginBottom: SPACE.xs,
  },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: COLORS.gold, letterSpacing: 1, marginTop: SPACE.hair },
  subText: { fontSize: FONT_SIZES.md, color: COLORS.textDim, fontFamily: FONTS.body },
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  cardPadding: { padding: SPACE.lg },
  cardLabel: {
    fontSize: FONT_SIZES.xs,
    fontFamily: FONTS.display,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: SPACE.sm,
  },
  scoreValue: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.displayBlack,
    color: COLORS.gold,
  },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  membershipValue: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: COLORS.text },
  membershipArrow: { fontSize: FONT_SIZES.md, color: COLORS.gold, fontFamily: FONTS.body },
  bioText: { fontSize: FONT_SIZES.md, color: COLORS.textDim, lineHeight: 22, fontFamily: FONTS.body },
  oathRow: { marginTop: SPACE.hair },
  oathPrompt: { fontSize: FONT_SIZES.md, color: COLORS.gold, fontFamily: FONTS.body, lineHeight: 20 },
  oathSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  oathSheetTitle: { fontSize: FONT_SIZES.xl, fontFamily: FONTS.display, color: COLORS.text, marginBottom: SPACE.hair },
  oathSheetHelp: { fontSize: FONT_SIZES.sm, color: COLORS.textDim, fontFamily: FONTS.body, lineHeight: 17 },
  oathOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    backgroundColor: COLORS.panelRaised,
  },
  oathOptionCurrent: { borderColor: COLORS.gold, borderWidth: 2 },
  oathOptionSigil: { width: 30, height: 30 },
  oathOptionSigilDim: { opacity: 0.5 },
  oathOptionText: { flex: 1, gap: SPACE.hair },
  oathOptionName: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.bodyBold, color: COLORS.text },
  oathOptionDesc: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.body, color: COLORS.textDim, lineHeight: 17 },
  editButtonWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm },
  signOutWrapper: { marginHorizontal: SPACE.gutter, marginTop: SPACE.md },
});
