import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { usePhotoUpload } from '../usePhotoUpload';
import * as ImagePicker from 'expo-image-picker';
import { apiClient } from '../../lib/api/apiClient';

// Factory form, not the bare `jest.mock('../../lib/api/apiClient')` automock —
// the automock still has to load the real module once to introspect its
// shape, which cascades through lib/api.ts into lib/supabase.ts's real
// createClient() call at module scope and throws on the missing
// EXPO_PUBLIC_SUPABASE_URL env var in the test environment. A factory skips
// loading the real module entirely.
jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { photos: { upload: jest.fn(), uploadUri: jest.fn() } },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

const mockUpload = apiClient.photos.upload as jest.Mock;
const mockUploadUri = apiClient.photos.uploadUri as jest.Mock;
const mockRequestMediaLibrary = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockRequestCamera = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockLaunchCamera = ImagePicker.launchCameraAsync as jest.Mock;

describe('usePhotoUpload pickPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array and never opens the library when permission is denied', async () => {
    mockRequestMediaLibrary.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uris: string[] = ['unset'];
    await act(async () => {
      uris = await result.current.pickPhoto(6);
    });

    expect(uris).toEqual([]);
    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it('returns an empty array when the user cancels the picker', async () => {
    mockRequestMediaLibrary.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uris: string[] = ['unset'];
    await act(async () => {
      uris = await result.current.pickPhoto(6);
    });

    expect(uris).toEqual([]);
  });

  it('returns every picked asset uri on success', async () => {
    mockRequestMediaLibrary.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://local/a.jpg' }, { uri: 'file://local/b.jpg' }],
    });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uris: string[] = [];
    await act(async () => {
      uris = await result.current.pickPhoto(6);
    });

    expect(uris).toEqual(['file://local/a.jpg', 'file://local/b.jpg']);
  });

  it('passes selectionLimit through to the picker call', async () => {
    mockRequestMediaLibrary.mockResolvedValue({ granted: true });
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://local/a.jpg' }] });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    await act(async () => {
      await result.current.pickPhoto(3);
    });

    expect(mockLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 3, allowsMultipleSelection: true }));
  });
});

describe('usePhotoUpload takePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null and never opens the camera when permission is denied', async () => {
    mockRequestCamera.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uri: string | null = 'unset';
    await act(async () => {
      uri = await result.current.takePhoto();
    });

    expect(uri).toBeNull();
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('returns null when the user cancels', async () => {
    mockRequestCamera.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({ canceled: true, assets: null });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uri: string | null = 'unset';
    await act(async () => {
      uri = await result.current.takePhoto();
    });

    expect(uri).toBeNull();
  });

  it('returns the captured asset uri on success', async () => {
    mockRequestCamera.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://local/b.jpg' }] });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uri: string | null = null;
    await act(async () => {
      uri = await result.current.takePhoto();
    });

    expect(uri).toBe('file://local/b.jpg');
  });
});

describe('usePhotoUpload uploadPhoto on native — streams the uri directly, never reads it into a Blob', () => {
  const originalOS = Platform.OS;
  const localUri = 'file:///local/dead-beef-1234.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('returns the server-hosted url on success, without ever calling fetch on the local uri', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    mockUploadUri.mockResolvedValue({ url: 'https://cdn.example.com/photo123.jpg' });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBe('https://cdn.example.com/photo123.jpg');
    expect(mockUploadUri).toHaveBeenCalledWith(localUri, 'photo.jpg');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null — NOT the local uri — when the engine upload rejects', async () => {
    mockUploadUri.mockRejectedValue(new Error('500 server error'));
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = 'unset';
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBeNull();
    expect(url).not.toBe(localUri);
  });

  it('returns null when the server responds without a url', async () => {
    mockUploadUri.mockResolvedValue({ url: undefined });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = 'unset';
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBeNull();
  });

  it('toggles uploading true during the request and back to false afterward, on both success and failure', async () => {
    let resolveUpload!: (v: unknown) => void;
    mockUploadUri.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let uploadPromise!: Promise<string | null>;
    act(() => {
      uploadPromise = result.current.uploadPhoto(localUri);
    });
    expect(result.current.uploading).toBe(true);

    await act(async () => {
      resolveUpload({ url: 'https://cdn.example.com/x.jpg' });
      await uploadPromise;
    });
    expect(result.current.uploading).toBe(false);
  });
});

describe('usePhotoUpload uploadPhoto on web — reads the picked blob: URI into a real Blob', () => {
  const originalOS = Platform.OS;
  const originalFetch = global.fetch;
  const localUri = 'blob:http://localhost/dead-beef-1234';

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'web';
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }) as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Platform.OS = originalOS;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the server-hosted url on success', async () => {
    mockUpload.mockResolvedValue({ url: 'https://cdn.example.com/photo123.jpg' });
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBe('https://cdn.example.com/photo123.jpg');
    expect(mockUploadUri).not.toHaveBeenCalled();
  });

  it('returns null — NOT the local blob: uri — when the engine upload rejects', async () => {
    mockUpload.mockRejectedValue(new Error('500 server error'));
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = 'unset';
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBeNull();
    expect(url).not.toBe(localUri);
  });

  it('returns null — NOT the local blob: uri — when fetching the local uri itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('failed to read local uri')) as unknown as typeof fetch;
    const { result } = renderHook(() => usePhotoUpload('u1'));

    let url: string | null = 'unset';
    await act(async () => {
      url = await result.current.uploadPhoto(localUri);
    });

    expect(url).toBeNull();
    expect(url).not.toBe(localUri);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
