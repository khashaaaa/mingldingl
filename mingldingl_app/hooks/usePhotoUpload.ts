import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../lib/api/apiClient';
import { getApiErrorMessage } from '../lib/api/errors';
import { i18n } from '../lib/i18n';

export function usePhotoUpload(userId: string | undefined) {
  const [uploadCount, setUploadCount] = useState(0);

  const [permissionDenied, setPermissionDenied] = useState(false);
  // Why the last upload failed, in the caller's language. The engine distinguishes a photo that is
  // too large, one whose *dimensions* are (a decompression bomb, refused before decoding) and one
  // rejected by the per-user rate limit — all of which used to collapse into "upload failed".
  const [lastError, setLastError] = useState<string | null>(null);

  async function pickPhoto(selectionLimit: number): Promise<string[]> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setPermissionDenied(true); return []; }
    setPermissionDenied(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled || !result.assets?.length) return [];
      return result.assets.map((asset) => asset.uri);
    } catch {
      return [];
    }
  }

  async function takePhoto(): Promise<string | null> {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { setPermissionDenied(true); return null; }
    setPermissionDenied(false);
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  }

  async function uploadPhoto(localUri: string): Promise<string | null> {
    setUploadCount((c) => c + 1);
    setLastError(null);
    try {
      const { url } = Platform.OS === 'web'
        ? await (async () => {
            const rawBlob = await (await fetch(localUri)).blob();
            const blob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: 'image/jpeg' });
            return apiClient.photos.upload(blob, 'photo.jpg');
          })()
        : await apiClient.photos.uploadUri(localUri, 'photo.jpg');
      return url ?? null;
    } catch (err) {
      console.error('Photo upload failed:', err, (err as { response?: { data?: unknown } })?.response?.data);
      setLastError(getApiErrorMessage(err, i18n.t('photo_upload_failed_body')));
      return null;
    } finally {
      setUploadCount((c) => c - 1);
    }
  }

  return {
    pickPhoto,
    takePhoto,
    uploadPhoto,
    uploading: uploadCount > 0,
    lastError,
    clearLastError: () => setLastError(null),
    permissionDenied,
    clearPermissionDenied: () => setPermissionDenied(false),
  };
}
