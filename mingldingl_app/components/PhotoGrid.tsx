import { useRef, useState } from 'react';
import { Image, Modal, Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Spinner } from 'tamagui';
import { useAuthStore } from '../store/authStore';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { Icon } from './ui/Icon';
import { AlertModal } from './modals/AlertModal';
import { GameButton } from './ui/GameButton';
import { i18n } from '../lib/i18n';
import { COLORS, RADIUS, overlay } from '../lib/theme';

interface Props {
  photoUrls: string[];
  maxPhotos?: number;
  onChange: (next: string[] | ((prev: string[]) => string[])) => void;
}

const TILE = 90;

// Shared by onboarding (PhotosStep) and edit-profile — the only two places
// that manage a user's own photo set. Photo #0 is always "primary" (first
// photo shown on cards, first to reveal in progressive reveal); tapping any
// other photo's star promotes it to that slot instead. Library picking is a
// multi-select batch (uncropped — see usePhotoUpload's pickPhoto comment);
// the camera is inherently one shot at a time and keeps its crop step.
export function PhotoGrid({ photoUrls, maxPhotos = 6, onChange }: Props) {
  const session = useAuthStore((s) => s.session);
  const { pickPhoto, takePhoto, uploadPhoto, uploading } = usePhotoUpload(session?.user.id);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [failedAlert, setFailedAlert] = useState(false);
  const [pendingLocalUris, setPendingLocalUris] = useState<string[]>([]);
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);
  const pendingSourceActionRef = useRef<(() => void) | null>(null);

  // Closing our own action-sheet Modal and immediately presenting the native
  // OS image/camera picker in the same tick races the Modal's dismiss
  // animation — iOS silently drops a new presentation attempted while the
  // previous RCTModalHostViewController hasn't actually finished dismissing
  // yet ("...whose view is not in the window hierarchy"), so the OS picker
  // never appears and launchImageLibraryAsync/launchCameraAsync then wait
  // forever for an interaction with a screen nobody ever saw. A fixed delay
  // here can't be trusted — the real dismiss can take longer than usual (e.g.
  // when it's racing the JS thread doing upload/re-render work from a photo
  // just added), so this waits for the Modal's own `onDismiss` — RN's actual
  // signal that the previous presentation is gone — before launching the
  // next one, instead of guessing a duration.
  function closeSourceModalThen(action: () => void) {
    if (Platform.OS === 'ios') {
      pendingSourceActionRef.current = action;
      setSourceModalVisible(false);
    } else {
      setSourceModalVisible(false);
      action();
    }
  }

  async function addPhotos(localUris: string[]) {
    if (localUris.length === 0) return;
    setPendingLocalUris((prev) => [...prev, ...localUris]);
    // Functional updates throughout: `uploadPhoto` awaits across a render
    // gap, so the `photoUrls` prop captured at call time can go stale if the
    // user deletes or reorders photos while this upload is in flight. Basing
    // every onChange call on the *current* list at fire time (not a snapshot
    // from when the upload started) means a concurrent edit is never
    // silently undone when the upload settles.
    onChange((prev) => [...prev, ...localUris]);
    // Each upload succeeds/fails independently — a batch of 5 where 1 fails
    // still keeps the other 4, rather than an all-or-nothing Promise.all
    // rejecting the whole selection over one bad file.
    const results = await Promise.all(
      localUris.map(async (localUri) => ({ localUri, publicUrl: await uploadPhoto(localUri) })),
    );
    setPendingLocalUris((prev) => prev.filter((u) => !localUris.includes(u)));
    const succeeded = new Map(results.filter((r) => r.publicUrl).map((r) => [r.localUri, r.publicUrl!]));
    const failedUris = new Set(results.filter((r) => !r.publicUrl).map((r) => r.localUri));
    if (succeeded.size > 0) {
      onChange((prev) => prev.map((u) => succeeded.get(u) ?? u));
    }
    if (failedUris.size > 0) {
      // Upload failed — drop the dead local URI wherever it currently sits,
      // without touching any other edits made while the upload was pending.
      onChange((prev) => prev.filter((u) => !failedUris.has(u)));
      setFailedAlert(true);
    }
  }

  function handleDelete(url: string) {
    onChange((prev) => prev.filter((u) => u !== url));
  }

  function handleSetPrimary(url: string) {
    onChange((prev) => [url, ...prev.filter((u) => u !== url)]);
  }

  return (
    <View style={styles.grid}>
      {photoUrls.map((url, i) => (
        <View key={url} style={styles.tile}>
          <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          {pendingLocalUris.includes(url) && (
            <View style={styles.uploadOverlay}>
              <Spinner size="small" color="$gold" />
            </View>
          )}
          {i === 0 && (
            <View style={styles.primaryBadge}>
              <Icon name="star" size={11} color={COLORS.bg} />
            </View>
          )}
          <TouchableOpacity
            style={styles.deleteButton}
            accessibilityLabel={i18n.t('remove_photo')}
            onPress={() => setPendingDeleteUrl(url)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="close" size={13} color={COLORS.text} />
          </TouchableOpacity>
          {i !== 0 && (
            <TouchableOpacity
              style={styles.primaryButton}
              accessibilityLabel={i18n.t('set_as_primary')}
              onPress={() => handleSetPrimary(url)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="star-outline" size={13} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {photoUrls.length < maxPhotos && (
        <TouchableOpacity
          style={[styles.tile, styles.addTile]}
          disabled={uploading}
          onPress={() => setSourceModalVisible(true)}
        >
          {uploading ? <Spinner size="small" color="$gold" /> : <Icon name="image-plus" size={26} color={COLORS.textDim} />}
        </TouchableOpacity>
      )}

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
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <GameButton
              variant="ghost"
              icon="image-multiple"
              onPress={() => closeSourceModalThen(async () => addPhotos(await pickPhoto(maxPhotos - photoUrls.length)))}
            >
              {i18n.t('pick_from_library')}
            </GameButton>
            {Platform.OS !== 'web' && (
              <GameButton
                variant="ghost"
                icon="camera-plus"
                onPress={() => closeSourceModalThen(async () => {
                  const uri = await takePhoto();
                  addPhotos(uri ? [uri] : []);
                })}
              >
                {i18n.t('take_photo')}
              </GameButton>
            )}
            <GameButton variant="ghost" onPress={() => setSourceModalVisible(false)}>
              {i18n.t('back')}
            </GameButton>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={failedAlert}
        tone="warning"
        title={i18n.t('photo_upload_failed_title')}
        message={i18n.t('photo_upload_failed_body')}
        onDismiss={() => setFailedAlert(false)}
      />

      <AlertModal
        visible={pendingDeleteUrl !== null}
        tone="warning"
        title={i18n.t('delete_photo_confirm_title')}
        message={i18n.t('delete_photo_confirm_body')}
        confirmLabel={i18n.t('remove_photo')}
        onConfirm={() => {
          if (pendingDeleteUrl) handleDelete(pendingDeleteUrl);
          setPendingDeleteUrl(null);
        }}
        onDismiss={() => setPendingDeleteUrl(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: TILE, height: TILE, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.panel },
  image: { width: '100%', height: '100%' },
  addTile: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.bronze,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlay(0.55),
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBadge: {
    position: 'absolute', top: 4, left: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(10,11,16,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButton: {
    position: 'absolute', bottom: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(10,11,16,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  // 0.88, matching AlertModal — this is a centered card (justifyContent:
  // 'center', bordered panel), not a bottom sheet, so it needs the same
  // dim strength as AlertModal rather than the bottom-sheet convention
  // (CityPickerModal, chat's options sheet both intentionally use 0.6).
  overlay: { flex: 1, backgroundColor: overlay(0.88), alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: {
    width: '100%', maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: 16, gap: 10,
  },
});
