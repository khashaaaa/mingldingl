import { useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../lib/api/apiClient';

export function usePhotoUpload(userId: string | undefined) {
  // A count, not a bool — pickPhoto can hand uploadPhoto several uris at
  // once (see PhotoGrid's addPhotos, which runs them in parallel), and each
  // one's own finally block must not flip `uploading` false while a sibling
  // upload is still in flight.
  const [uploadCount, setUploadCount] = useState(0);
  // Both pickPhoto and takePhoto used to fail dead silent on a denied
  // permission — requestMediaLibraryPermissionsAsync/requestCameraPermissionsAsync
  // resolve normally either way, so nothing threw and nothing logged; the
  // picker sheet just closed with no photo and no explanation. Surfacing
  // this lets callers show the same permission-denied messaging
  // useLocationCapture already uses for GPS.
  const [permissionDenied, setPermissionDenied] = useState(false);

  // expo-image-picker silently ignores allowsEditing (the native crop-to-
  // square UI) under allowsMultipleSelection, so library picking trades crop
  // control for batch selection — selectionLimit caps it at whatever's left
  // of PhotoGrid's maxPhotos. takePhoto below is a separate picker call and
  // keeps allowsEditing; the constraint is per-call, not global.
  //
  // allowsEditing's crop step used to have a side effect this relied on:
  // iOS always returns the *edited* image as JPEG, which silently normalized
  // away HEIC — iOS's default photo-library format since iOS 11, and one
  // ImageSharp (the engine's decoder, PhotoCompressionService.cs) can't read.
  // Without that crop step, raw HEIC bytes reached the engine and got
  // rejected with "Could not read this file as an image". Compatible mode is
  // PHPickerConfiguration's own fix for this — it hands back the JPEG
  // representation regardless of the source asset's format. No-op on
  // Android, which doesn't hand back HEIC in the first place.
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

  // Returns null on failure — never the local URI. A blob:/file: URI only
  // resolves inside the session/app that created it, so falling back to it
  // used to leave a permanently dead photo URL saved on the profile the
  // moment a single upload failed (this is exactly how the "Playwright
  // Tester" seed accounts ended up with blob: URLs stuck in PhotoUrls).
  //
  // Uploads go through the engine (not straight to Supabase Storage) so the
  // server can compress every photo before it's stored — the engine mints
  // its own storage path server-side, so no client-side uniqueness scheme
  // is needed here anymore.
  async function uploadPhoto(localUri: string): Promise<string | null> {
    setUploadCount((c) => c + 1);
    try {
      // On native, fetch(localUri).blob() was silently producing a
      // zero-byte Blob for expo-image-picker's file:// output — the engine
      // saw a well-formed but empty multipart body and rejected it. Native
      // FormData understands a { uri, name, type } shorthand instead, which
      // has the native networking layer stream the file straight off disk
      // rather than reading it into a JS Blob first. Web has no local
      // filesystem to stream from and fetch().blob() there is a real,
      // already-in-memory Blob (from a browser file input), so it keeps the
      // old path.
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
