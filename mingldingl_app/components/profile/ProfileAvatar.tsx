import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AlertModal } from '../modals/AlertModal';
import { SheetModal } from '../modals/SheetModal';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';
import { TorchGlow } from '../vfx/TorchGlow';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { useUpdateProfile } from '../../hooks/useProfile';
import { useAuthStore } from '../../store/authStore';
import { i18n } from '../../lib/i18n';
import { COLORS, ICON_SIZES, RADIUS, SPACE, circle, overlay } from '../../lib/theme';

interface Props {
  /** The whole list, not just the first: replacing the portrait rewrites slot 0 and keeps the rest. */
  photoUrls: string[];
  /** The current gem tier's colour: the ring, the torch glow and the ring's cast shadow all wear it. */
  tierColor: string;
}

/** The character portrait, and the picker + upload flow behind tapping it. */
export function ProfileAvatar({ photoUrls, tierColor }: Props) {
  const session = useAuthStore((s) => s.session);
  const { pickPhoto, takePhoto, uploadPhoto, uploading, lastError, clearLastError, permissionDenied, clearPermissionDenied } =
    usePhotoUpload(session?.user.id);
  const { mutateAsync: saveProfile, previewPatch } = useUpdateProfile();
  // Remembering *which* URL failed, rather than a boolean, means a new URL is always tried.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [uploadFailedAlert, setUploadFailedAlert] = useState(false);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);

  const photoUrl = photoUrls[0];
  const showPhoto = !!photoUrl && photoUrl !== failedUrl;

  async function handleAddFrom(picker: () => Promise<string | null>) {
    const localUri = await picker();
    if (!localUri) return;

    // Show the picked photo at once, before the upload it depends on has even started; the undo
    // restores the whole previous profile, so a failed upload never leaves slot 0 missing.
    const nextPhotoUrls = [localUri, ...photoUrls.slice(1)];
    const undoPreview = previewPatch({ photoUrls: nextPhotoUrls });

    const publicUrl = await uploadPhoto(localUri);
    if (!publicUrl) {
      undoPreview();
      setUploadFailedAlert(true);
      return;
    }
    try {
      await saveProfile({ photoUrls: nextPhotoUrls.map((u) => (u === localUri ? publicUrl : u)) });
    } catch {
      undoPreview();
      setUploadFailedAlert(true);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={styles.avatarTouchable}
        onPress={() => setSourceModalVisible(true)}
        disabled={uploading}
        accessibilityLabel={i18n.t('change_avatar')}
      >
        <TorchGlow size={118} color={tierColor}>
          <View style={styles.avatarFrame}>
            <View style={[styles.avatarFrameRotated, { borderColor: tierColor }]} />
            <View style={[styles.avatarRing, { borderColor: tierColor, shadowColor: tierColor }]}>
              <View style={styles.avatarClip}>
                {showPhoto ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    onError={() => setFailedUrl(photoUrl ?? null)}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="camera" size={ICON_SIZES.huge} color={COLORS.gold} />
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
              <Icon name="pencil" size={ICON_SIZES.sm} color={COLORS.bg} />
            </View>
          </View>
        </TorchGlow>
      </TouchableOpacity>

      <SheetModal visible={sourceModalVisible} onClose={() => setSourceModalVisible(false)}>
        {(closeThen) => (
          <>
            <GameButton
              variant="ghost"
              icon="image-multiple"
              onPress={() => closeThen(async () => handleAddFrom(async () => (await pickPhoto(1))[0] ?? null))}
            >
              {i18n.t('pick_from_library')}
            </GameButton>
            {Platform.OS !== 'web' && (
              <GameButton
                variant="ghost"
                icon="camera-plus"
                onPress={() => closeThen(async () => handleAddFrom(takePhoto))}
              >
                {i18n.t('take_photo')}
              </GameButton>
            )}
            <GameButton variant="ghost" onPress={() => setSourceModalVisible(false)}>
              {i18n.t('back')}
            </GameButton>
          </>
        )}
      </SheetModal>

      <AlertModal
        visible={uploadFailedAlert}
        tone="warning"
        title={i18n.t('photo_upload_failed_title')}
        message={lastError ?? i18n.t('photo_upload_failed_body')}
        onDismiss={() => { setUploadFailedAlert(false); clearLastError(); }}
      />
      <AlertModal
        visible={permissionDenied}
        tone="warning"
        title={i18n.t('photo_permission_denied_title')}
        message={i18n.t('photo_permission_denied_body')}
        onDismiss={clearPermissionDenied}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  avatarImage: { width: 100, height: 100 },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: overlay(0.55),
  },
});
