import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ProfileAvatar } from '../ProfileAvatar';
import { apiClient } from '../../../lib/api/apiClient';
import { createAppQueryClient } from '../../../lib/api/queryClient';
import { queryKeys } from '../../../lib/api/queryKeys';
import { i18n } from '../../../lib/i18n';
import type { UserProfile } from '../../../models/user';

const mockPickPhoto = jest.fn();
const mockUploadPhoto = jest.fn();

jest.mock('../../../hooks/usePhotoUpload', () => ({
  usePhotoUpload: () => ({
    pickPhoto: mockPickPhoto,
    takePhoto: jest.fn(),
    uploadPhoto: mockUploadPhoto,
    uploading: false,
    permissionDenied: false,
    clearPermissionDenied: jest.fn(),
  }),
}));

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { users: { update: jest.fn() } },
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ session: { user: { id: 'u1' } } }),
}));

const mockUpdate = apiClient.users.update as jest.Mock;

const cached = { id: 'u1', displayName: 'Bat', photoUrls: ['OLD', 'B', 'C'] } as UserProfile;

function renderAvatar(photoUrls = ['OLD', 'B', 'C']) {
  const qc = createAppQueryClient();
  qc.setQueryData(queryKeys.userProfile, cached);
  const utils = render(
    <QueryClientProvider client={qc}>
      <ProfileAvatar photoUrls={photoUrls} tierColor="#fff" />
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

function cachedPhotos(qc: ReturnType<typeof createAppQueryClient>) {
  return qc.getQueryData<UserProfile>(queryKeys.userProfile)?.photoUrls;
}

describe('ProfileAvatar', () => {
  const realOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    // The Android branch of closeThen runs the picker synchronously, which keeps these tests
    // off the iOS onDismiss handshake that SheetModal.test.tsx already covers.
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  });

  async function pickFromLibrary(utils: ReturnType<typeof renderAvatar>) {
    fireEvent.press(utils.getByLabelText(i18n.t('change_avatar')));
    await act(async () => {
      // GameButton uppercases its label.
      fireEvent.press(utils.getByText(i18n.t('pick_from_library').toUpperCase()));
    });
  }

  it('previews the picked photo in slot 0 and then saves the uploaded URL', async () => {
    mockPickPhoto.mockResolvedValue(['file://local.jpg']);
    mockUploadPhoto.mockResolvedValue('https://cdn/new.jpg');
    mockUpdate.mockResolvedValue({ id: 'u1', displayName: 'Bat', photoUrls: ['https://cdn/new.jpg', 'B', 'C'] });

    const view = renderAvatar();
    const { getByText, qc } = view;
    await pickFromLibrary(view);

    expect(mockUpdate).toHaveBeenCalledWith({ photoUrls: ['https://cdn/new.jpg', 'B', 'C'] });
    await waitFor(() => expect(cachedPhotos(qc)).toEqual(['https://cdn/new.jpg', 'B', 'C']));
  });

  it('shows the picked photo in the cache while the upload is still in flight', async () => {
    mockPickPhoto.mockResolvedValue(['file://local.jpg']);
    let finishUpload: (url: string | null) => void = () => {};
    mockUploadPhoto.mockReturnValue(new Promise<string | null>((resolve) => { finishUpload = resolve; }));
    mockUpdate.mockResolvedValue({ id: 'u1', photoUrls: ['https://cdn/new.jpg', 'B', 'C'] });

    const view = renderAvatar();
    await pickFromLibrary(view);

    expect(cachedPhotos(view.qc)).toEqual(['file://local.jpg', 'B', 'C']);

    await act(async () => { finishUpload('https://cdn/new.jpg'); });
    await waitFor(() => expect(cachedPhotos(view.qc)).toEqual(['https://cdn/new.jpg', 'B', 'C']));
  });

  it('restores the previous profile when the upload fails', async () => {
    mockPickPhoto.mockResolvedValue(['file://local.jpg']);
    mockUploadPhoto.mockResolvedValue(null);

    const view = renderAvatar();
    const { findByText, qc } = view;
    await pickFromLibrary(view);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(cachedPhotos(qc)).toEqual(['OLD', 'B', 'C']);
    expect(await findByText(i18n.t('photo_upload_failed_title'))).toBeTruthy();
  });

  it('restores the previous profile when the save fails after a successful upload', async () => {
    mockPickPhoto.mockResolvedValue(['file://local.jpg']);
    mockUploadPhoto.mockResolvedValue('https://cdn/new.jpg');
    mockUpdate.mockRejectedValue(new Error('network'));

    const view = renderAvatar();
    const { findByText, qc } = view;
    await pickFromLibrary(view);

    await waitFor(() => expect(cachedPhotos(qc)).toEqual(['OLD', 'B', 'C']));
    expect(await findByText(i18n.t('photo_upload_failed_title'))).toBeTruthy();
  });

  it('does nothing at all when the picker is cancelled', async () => {
    mockPickPhoto.mockResolvedValue([]);

    const view = renderAvatar();
    const { getByText, qc } = view;
    await pickFromLibrary(view);

    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(cachedPhotos(qc)).toEqual(['OLD', 'B', 'C']);
  });

  it('keeps the other slots when the profile has only one photo', async () => {
    mockPickPhoto.mockResolvedValue(['file://local.jpg']);
    mockUploadPhoto.mockResolvedValue('https://cdn/new.jpg');
    mockUpdate.mockResolvedValue({ id: 'u1', photoUrls: ['https://cdn/new.jpg'] });

    const view = renderAvatar([]);
    await pickFromLibrary(view);

    expect(mockUpdate).toHaveBeenCalledWith({ photoUrls: ['https://cdn/new.jpg'] });
  });
});
