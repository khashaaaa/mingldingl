import { useState } from 'react';
import { Tap } from '../ui/Tap';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AlertModal } from '../modals/AlertModal';
import { SheetModal } from '../modals/SheetModal';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';
import { Waiting } from '../ui/Waiting';
import { TorchGlow } from '../vfx/TorchGlow';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { useUpdateProfile } from '../../hooks/useProfile';
import { i18n } from '../../lib/i18n';
import { ACCENT, ICON_SIZES, METAL, RADIUS, SCRIM, SPACE, SURFACE, circle, overlay } from '../../lib/theme';
interface Props {
  /** The whole list, not just the first: replacing the portrait rewrites slot 0 and keeps the rest. */
  photoUrls: string[];
  /** The current gem tier's colour: the ring, the torch glow and the ring's cast shadow all wear it. */
  tierColor: string;
}

/** The character portrait, and the picker + upload flow behind tapping it. */
export function ProfileAvatar({ photoUrls, tierColor }: Props) {
  const { pickPhoto, takePhoto, uploadPhoto, uploading, lastError, clearLastError, permissionDenied, clearPermissionDenied } =
    usePhotoUpload();
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
      <Tap
        style={styles.avatarTouchable}
        onPress={() => setSourceModalVisible(true)}
        disabled={uploading}
        accessibilityRole="button"
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
                    <Icon name="camera" size={ICON_SIZES.huge} color={ACCENT.base} />
                  </View>
                )}
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <Waiting color={tierColor} />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.avatarEditBadge}>
              <Icon name="pencil" size={ICON_SIZES.sm} color={SURFACE.ground} />
            </View>
          </View>
        </TorchGlow>
      </Tap>

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
    backgroundColor: SURFACE.raised,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: SPACE.hair,
    right: SPACE.hair,
    ...circle(26),
    backgroundColor: METAL.gold,
    borderWidth: 2,
    borderColor: SURFACE.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 100, height: 100 },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: overlay(SCRIM.veil),
  },
});
