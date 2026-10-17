import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  deletePhoto,
  getGetMeQueryKey,
  getListMyPhotosQueryKey,
  reorderPhotos,
  uploadPhoto,
  useListMyPhotos,
} from '@/lib/api/generated/engine';
import type { PhotoView } from '@/lib/api/generated/model';

/** A portrait on its way up. Its key is the upload's Idempotency-Key and lives until the upload settles. */
export type Pending = { key: string; base64: string; status: 'uploading' | 'failed' };

/**
 * SDK 57's global fetch is expo/fetch, which sends a form part only if it is a Blob or has `bytes()`
 * — React Native's `{ uri }` part is refused ("Unsupported FormDataPart implementation").
 */
export const jpegPart = (base64: string) =>
  ({
    name: 'portrait.jpg',
    type: 'image/jpeg',
    bytes: async () => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  }) as unknown as Blob;

/** Unique per upload, not secret: the engine only uses it to recognise a retry of the same file. */
export const newUploadKey = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * The person's portraits and the ones still uploading. A failed upload keeps its key, so a retry the
 * engine already finished returns the same photo instead of making a second one.
 */
export function usePortraits(max: number) {
  const client = useQueryClient();
  const photos = useListMyPhotos();
  const [pending, setPending] = useState<Pending[]>([]);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const live = useRef(pending);
  live.current = pending;

  const settle = useCallback(
    (list: PhotoView[] | undefined) => {
      if (list) client.setQueryData(getListMyPhotosQueryKey(), list);
      else client.invalidateQueries({ queryKey: getListMyPhotosQueryKey(), exact: true });
      // The step a person is on counts their portraits.
      client.invalidateQueries({ queryKey: getGetMeQueryKey(), exact: true });
    },
    [client],
  );

  const send = useCallback(
    async (p: Pending) => {
      setPending((all) => all.map((x) => (x.key === p.key ? { ...x, status: 'uploading' } : x)));
      try {
        await uploadPhoto({ file: jpegPart(p.base64) }, { headers: { 'Idempotency-Key': p.key } });
        setPending((all) => all.filter((x) => x.key !== p.key));
        settle(undefined);
      } catch {
        setPending((all) => all.map((x) => (x.key === p.key ? { ...x, status: 'failed' } : x)));
      }
    },
    [settle],
  );

  const add = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setDenied(true);
    setDenied(false);
    const room = max - (photos.data?.length ?? 0) - live.current.length;
    if (room <= 0) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      // Below 1 the picker re-encodes to JPEG, which the engine can read (an iOS original may be HEIC).
      quality: 0.85,
      base64: true,
    });
    if (picked.canceled) return;
    const fresh = picked.assets
      .slice(0, room)
      .flatMap((a): Pending[] =>
        a.base64 ? [{ key: newUploadKey(), base64: a.base64, status: 'uploading' }] : [],
      );
    setPending((all) => [...all, ...fresh]);
    for (const p of fresh) await send(p);
  }, [max, photos.data?.length, send]);

  const retry = useCallback(
    (key: string) => {
      const p = live.current.find((x) => x.key === key);
      if (p) return send(p);
    },
    [send],
  );

  const run = useCallback(
    async (write: () => Promise<PhotoView[] | undefined>) => {
      setError(null);
      try {
        settle(await write());
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError('network', 0, 'network', String(e)));
      }
    },
    [settle],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await deletePhoto(id);
        return undefined;
      }),
    [run],
  );

  /** Moves one portrait to `to`; the rest keep their order. */
  const move = useCallback(
    (id: string, to: number) => {
      const ids = (photos.data ?? []).map((p) => p.id).filter((x) => x !== id);
      ids.splice(to, 0, id);
      return run(() => reorderPhotos({ ids }));
    },
    [photos.data, run],
  );

  return {
    photos: photos.data ?? [],
    loading: photos.isPending,
    pending,
    denied,
    error,
    add,
    retry,
    remove,
    move,
  };
}
