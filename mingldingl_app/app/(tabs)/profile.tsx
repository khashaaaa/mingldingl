import { useRef, useState } from 'react';
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
import { queryKeys } from '../../lib/api/queryKeys';
import { colorForTier, ITEM_NAME_KEYS, FRAME_COLORS } from '../../lib/tiers';
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
import { COLORS, FONTS, RADIUS, overlay } from '../../lib/theme';
import type { GemTier } from '../../models/user';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');

export default function ProfileScreen() {
  useLocaleStore((s) => s.locale); // forces re-render on language switch — see store/localeStore.ts
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: scoreDetail } = useScoreDetail();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const [photoError, setPhotoError] = useState(false);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const pendingSourceActionRef = useRef<(() => void) | null>(null);
  const { pickPhoto, takePhoto, uploadPhoto, uploading, permissionDenied, clearPermissionDenied } = usePhotoUpload(session?.user.id);
  const { items } = useInventory();

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

  // Closing our own action-sheet Modal and immediately presenting the native
  // OS image/camera picker in the same tick races the Modal's dismiss
  // animation — see PhotoGrid.tsx's identical closeSourceModalThen, which
  // this mirrors. Without it, the OS picker was silently dropped and
  // pickPhoto/takePhoto never got a chance to resolve or reject.
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
    setPhotoError(false);
    type Profile = NonNullable<typeof profile>;
    // Functional updates throughout (see PhotoGrid.tsx's identical comment):
    // uploadPhoto awaits across a render gap, so the `profile` captured at
    // call time can go stale if the user edits elsewhere while this upload
    // is in flight. Basing every update on the *current* cached profile at
    // fire time, not this closure's snapshot, means a concurrent edit is
    // never silently undone when the upload settles.
    queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
      prev ? { ...prev, photoUrls: [localUri, ...(prev.photoUrls ?? []).slice(1)] } : prev);
    const publicUrl = await uploadPhoto(localUri);
    if (publicUrl) {
      queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
        prev ? { ...prev, photoUrls: (prev.photoUrls ?? []).map((u) => (u === localUri ? publicUrl : u)) } : prev);
    } else {
      // Upload failed — drop the dead local URI wherever it currently sits,
      // without touching any other edits made while the upload was pending.
      queryClient.setQueryData<Profile>(queryKeys.userProfile, (prev) =>
        prev ? { ...prev, photoUrls: (prev.photoUrls ?? []).filter((u) => u !== localUri) } : prev);
      setUploadFailedAlert(true);
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
            <Text style={styles.equippedTitle}>{i18n.t(ITEM_NAME_KEYS[profile.equippedTitleId] ?? '')}</Text>
          )}
          <Text style={styles.subText}>{profile.age} · {profile.city}</Text>
        </View>
        <GemTierBadge tier={gemTier} size={44} glow />
      </View>

      <NextActionCard />

      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push('/progression')}>
        <AppCard tier={gemTier} textured style={{ padding: 16 }}>
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
            <Text style={styles.membershipValue}>{profile.membershipLevel}</Text>
            <Text style={styles.membershipArrow}>→</Text>
          </View>
        </TouchableOpacity>
      </AppCard>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  avatarTouchable: { alignSelf: 'center', marginTop: 8, marginBottom: 20 },
  avatarFrame: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  avatarFrameRotated: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderWidth: 2,
    borderRadius: 18,
    transform: [{ rotate: '45deg' }],
    opacity: 0.5,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarClip: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: COLORS.panelRaised,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 0.88, not the 0.6 other overlay() call sites in this file use — this is
  // a centered card (justifyContent: 'center', bordered panel), the same
  // visual language as AlertModal, not a bottom sheet like CityPickerModal
  // — it needs AlertModal's stronger dim, not the bottom-sheet convention.
  sourceOverlay: { flex: 1, backgroundColor: overlay(0.88), alignItems: 'center', justifyContent: 'center', padding: 24 },
  sourceSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: 16,
    gap: 10,
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
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  nameBlock: { flex: 1 },
  displayName: {
    fontSize: 22,
    fontFamily: FONTS.display,
    color: COLORS.text,
    marginBottom: 4,
  },
  equippedTitle: { fontSize: 12, fontFamily: FONTS.display, color: COLORS.gold, letterSpacing: 1, marginTop: 2 },
  subText: { fontSize: 14, color: COLORS.textDim, fontFamily: FONTS.body },
  card: { marginHorizontal: 20, marginBottom: 16 },
  cardPadding: { padding: 16 },
  cardLabel: {
    fontSize: 10,
    fontFamily: FONTS.display,
    color: COLORS.textDim,
    letterSpacing: 2,
    marginBottom: 6,
  },
  scoreValue: {
    fontSize: 26,
    fontFamily: FONTS.displayBlack,
    color: COLORS.gold,
  },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  membershipValue: { fontSize: 16, fontFamily: FONTS.bodyBold, color: COLORS.text },
  membershipArrow: { fontSize: 14, color: COLORS.gold, fontFamily: FONTS.body },
  bioText: { fontSize: 14, color: COLORS.textDim, lineHeight: 22, fontFamily: FONTS.body },
  editButtonWrapper: { marginHorizontal: 20, marginTop: 8 },
  signOutWrapper: { marginHorizontal: 20, marginTop: 12 },
});
