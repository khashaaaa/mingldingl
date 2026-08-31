import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../lib/api/apiClient';

export function usePhotoUpload(userId: string | undefined) {
  const [uploadCount, setUploadCount] = useState(0);

  const [permissionDenied, setPermissionDenied] = useState(false);

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
    permissionDenied,
    clearPermissionDenied: () => setPermissionDenied(false),
  };
}
