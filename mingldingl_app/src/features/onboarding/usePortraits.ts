import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * A portrait on its way up. Its key is the upload's Idempotency-Key and lives until the upload settles.
 * `photoId` is set once the engine stored it: the tile stays until that photo is in the list, so the
 * slot is never empty in between (which shifted the grid and looked like the portraits reordering).
 */
export type Pending = {
  key: string;
  base64: string;
  uri: string;
  status: 'uploading' | 'failed';
  photoId?: string;
};

const byPosition = (list: PhotoView[]) => [...list].sort((a, b) => a.position - b.position);

/**
 * SDK 57's global fetch is expo/fetch, which sends a form part only if it is a Blob or has `bytes()`
 * — React Native's `{ uri }` part is refused ("Unsupported FormDataPart implementation").
 */
const jpegPart = (base64: string) =>
  ({
    name: 'portrait.jpg',
    type: 'image/jpeg',
    bytes: async () => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  }) as unknown as Blob;

/** Unique per upload, not secret: the engine only uses it to recognise a retry of the same file. */
const newUploadKey = () =>
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
  const [all, setPending] = useState<Pending[]>([]);
  const stored = useMemo(() => new Set((photos.data ?? []).map((x) => x.id)), [photos.data]);
  const pending = useMemo(() => all.filter((x) => !x.photoId || !stored.has(x.photoId)), [all, stored]);
  useEffect(() => {
    if (pending.length !== all.length)
      setPending((xs) => xs.filter((x) => !x.photoId || !stored.has(x.photoId)));
  }, [pending.length, all.length, stored]);
  /** Photo id → the device's own file, for portraits uploaded on this screen (see PhotoTile `local`). */
  const [local, setLocal] = useState<Record<string, string>>({});
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
        const photo = await uploadPhoto(
          { file: jpegPart(p.base64) },
          { headers: { 'Idempotency-Key': p.key } },
        );
        const key = getListMyPhotosQueryKey();
        if (photo?.id && client.getQueryData(key)) {
          setLocal((all) => ({ ...all, [photo.id]: p.uri }));
          // A list fetched before this upload committed must not land after it and drop the photo.
          await client.cancelQueries({ queryKey: key, exact: true });
          client.setQueryData<PhotoView[]>(key, (list = []) =>
            list.some((x) => x.id === photo.id) ? list : byPosition([...list, photo]),
          );
          setPending((all) => all.map((x) => (x.key === p.key ? { ...x, photoId: photo.id } : x)));
          client.invalidateQueries({ queryKey: getGetMeQueryKey(), exact: true });
        } else {
          setPending((all) => all.filter((x) => x.key !== p.key));
          settle(undefined);
        }
      } catch (e) {
        // The engine refused this photo (no face, not a photo, too large): a retry cannot help, so it
        // leaves the grid and the reason is shown. Only a lost upload stays to be tried again.
        if (e instanceof ApiError && e.kind === 'rule') {
          setPending((all) => all.filter((x) => x.key !== p.key));
          setError(e);
        } else setPending((all) => all.map((x) => (x.key === p.key ? { ...x, status: 'failed' } : x)));
      }
    },
    [client, settle],
  );

  const add = useCallback(async () => {
    setError(null);
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
        a.base64 ? [{ key: newUploadKey(), base64: a.base64, uri: a.uri, status: 'uploading' }] : [],
      );
    setPending((all) => [...all, ...fresh]);
    for (const p of fresh) await send(p);
  }, [max, photos.data?.length, send]);

  /** One taken now with the app's own camera (PortraitCamera). */
  const addTaken = useCallback(
    async (shot: { base64: string; uri: string }) => {
      setError(null);
      if (max - (photos.data?.length ?? 0) - live.current.length <= 0) return;
      const p: Pending = { key: newUploadKey(), base64: shot.base64, uri: shot.uri, status: 'uploading' };
      setPending((all) => [...all, p]);
      await send(p);
    },
    [max, photos.data?.length, send],
  );

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

  /** Moves one portrait to `to`; the rest keep their order. The grid moves at once, and back if refused. */
  const move = useCallback(
    async (id: string, to: number) => {
      const key = getListMyPhotosQueryKey();
      const before = client.getQueryData<PhotoView[]>(key) ?? [];
      const moved = before.filter((x) => x.id !== id);
      const lifted = before.find((x) => x.id === id);
      if (!lifted) return;
      moved.splice(to, 0, lifted);
      await client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData<PhotoView[]>(
        key,
        moved.map((x, i) => ({ ...x, position: i })),
      );
      setError(null);
      try {
        settle(await reorderPhotos({ ids: moved.map((x) => x.id) }));
      } catch (e) {
        client.setQueryData(key, before);
        settle(undefined);
        setError(e instanceof ApiError ? e : new ApiError('network', 0, 'network', String(e)));
      }
    },
    [client, settle],
  );

  return {
    photos: photos.data ?? [],
    loading: photos.isPending,
    pending,
    local,
    denied,
    error,
    add,
    addTaken,
    retry,
    remove,
    move,
  };
}
