import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/authStore';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { Icon } from './ui/Icon';
import { AlertModal } from './modals/AlertModal';
import { GameButton } from './ui/GameButton';
import { i18n } from '../lib/i18n';
import { COLORS, RADIUS, SPACE, circle, overlay } from '../lib/theme';

interface Props {
  photoUrls: string[];
  maxPhotos?: number;
  onChange: (next: string[] | ((prev: string[]) => string[])) => void;
  /**
   * Newly picked photos land in `photoUrls` as local `file://` URIs before the upload finishes,
   * so a parent that gates "save" on the photo count alone can persist one of those placeholders.
   * Parents that can submit must block on this.
   */
  onUploadingChange?: (uploading: boolean) => void;
}

const TILE = 90;

export function PhotoGrid({ photoUrls, maxPhotos = 6, onChange, onUploadingChange }: Props) {
  const session = useAuthStore((s) => s.session);
  const { pickPhoto, takePhoto, uploadPhoto, uploading, permissionDenied, clearPermissionDenied } = usePhotoUpload(session?.user.id);
  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [failedAlert, setFailedAlert] = useState(false);
  const [pendingLocalUris, setPendingLocalUris] = useState<string[]>([]);
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);
  const pendingSourceActionRef = useRef<(() => void) | null>(null);

  // Held in a ref so an inline callback from the parent cannot make these effects re-run (and
  // flap the flag) on every render.
  const uploadingCbRef = useRef(onUploadingChange);
  uploadingCbRef.current = onUploadingChange;
  const hasPendingUploads = pendingLocalUris.length > 0;
  useEffect(() => { uploadingCbRef.current?.(hasPendingUploads); }, [hasPendingUploads]);
  useEffect(() => () => uploadingCbRef.current?.(false), []);

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

    onChange((prev) => [...prev, ...localUris]);

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
          <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
          {pendingLocalUris.includes(url) && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="small" color={COLORS.gold} />
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
          {uploading ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Icon name="image-plus" size={26} color={COLORS.textDim} />}
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
        visible={permissionDenied}
        tone="warning"
        title={i18n.t('photo_permission_denied_title')}
        message={i18n.t('photo_permission_denied_body')}
        onDismiss={clearPermissionDenied}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
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
    ...circle(18),
    backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute', top: 4, right: 4,
    ...circle(22),
    backgroundColor: overlay(0.75),
    alignItems: 'center', justifyContent: 'center',
  },
  primaryButton: {
    position: 'absolute', bottom: 4, right: 4,
    ...circle(22),
    backgroundColor: overlay(0.75),
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: { flex: 1, backgroundColor: overlay(0.88), alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  sheet: {
    width: '100%', maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: SPACE.lg, gap: SPACE.md,
  },
});
