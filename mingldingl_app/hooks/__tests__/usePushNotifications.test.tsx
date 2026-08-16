import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePushNotifications } from '../usePushNotifications';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';

// Factory form, not the bare automock — the automock still has to load the
// real module once to introspect its shape, which for expo-notifications
// and expo-router pulls in enough of the app's module graph to risk
// reaching lib/supabase.ts's real createClient() call at module scope
// (throws on the missing EXPO_PUBLIC_SUPABASE_URL env var in tests).
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
// A plain `{ isDevice: true }` mock object would get its properties copied
// by *value* into usePushNotifications.ts's `import * as Device` namespace
// at module-load time (see @babel/runtime's interopRequireWildcard) — later
// reassigning that value would not be seen by the already-loaded hook
// module. A getter descriptor is copied *live* instead, so toggling
// `mockIsDevice` actually changes what the hook observes.
let mockIsDevice = true;
jest.mock('expo-device', () => ({
  get isDevice() { return mockIsDevice; },
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { push: { register: jest.fn() } },
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockAddResponseListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
const mockRegister = apiClient.push.register as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockPush = jest.fn();

describe('usePushNotifications — foreground notification handler (module-scope)', () => {
  // This runs once, at import time of ../usePushNotifications, and is the
  // logic that decides whether a foreground push shows a banner. It's
  // captured directly off the mock rather than exercised through the hook,
  // since it's set up outside any React lifecycle.
  const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0].handleNotification;

  beforeEach(() => {
    useAuthStore.setState({ activeChatMatchId: null });
  });

  function notificationWith(matchId: string | undefined) {
    return { request: { content: { data: { matchId } } } };
  }

  it('suppresses the banner/sound when the notification is for the chat currently open', async () => {
    useAuthStore.setState({ activeChatMatchId: 'm1' });
    const behavior = await handler(notificationWith('m1'));
    expect(behavior).toEqual({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: true,
    });
  });

  it('shows the banner/sound when the notification is for a different match than the one open', async () => {
    useAuthStore.setState({ activeChatMatchId: 'm1' });
    const behavior = await handler(notificationWith('m2'));
    expect(behavior.shouldShowAlert).toBe(true);
    expect(behavior.shouldPlaySound).toBe(true);
    expect(behavior.shouldShowBanner).toBe(true);
  });

  it('shows the banner when no chat is currently open', async () => {
    useAuthStore.setState({ activeChatMatchId: null });
    const behavior = await handler(notificationWith('m1'));
    expect(behavior.shouldShowAlert).toBe(true);
  });

  it('shows the banner for a notification carrying no matchId at all', async () => {
    useAuthStore.setState({ activeChatMatchId: 'm1' });
    const behavior = await handler(notificationWith(undefined));
    expect(behavior.shouldShowAlert).toBe(true);
  });

  it('always sets the badge regardless of suppression', async () => {
    useAuthStore.setState({ activeChatMatchId: 'm1' });
    expect((await handler(notificationWith('m1'))).shouldSetBadge).toBe(true);
    expect((await handler(notificationWith('m2'))).shouldSetBadge).toBe(true);
  });
});

describe('usePushNotifications platform gating and registration flow', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIsDevice = true;
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockAddResponseListener.mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('is a total no-op on web: no permission checks, no listener registration', async () => {
    Platform.OS = 'web';
    renderHook(() => usePushNotifications());

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockAddResponseListener).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('is a no-op on a simulator/emulator (Device.isDevice false)', async () => {
    mockIsDevice = false;
    renderHook(() => usePushNotifications());

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers directly, without re-requesting, when permission is already granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockRegister.mockResolvedValue(undefined);
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('ExponentPushToken[abc]', 'ios'));
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted, and registers once the user grants it', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[xyz]' });
    mockRegister.mockResolvedValue(undefined);
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('ExponentPushToken[xyz]', 'ios'));
    expect(mockRequestPermissions).toHaveBeenCalled();
  });

  it('never requests a token or registers when the user denies the permission request', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockRequestPermissions).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('degrades silently (no crash, no register call) when getExpoPushTokenAsync throws (Expo Go / no EAS projectId)', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockRejectedValue(new Error('No "projectId" found'));
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockGetToken).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not throw when apiClient.push.register rejects', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'tok' });
    mockRegister.mockRejectedValue(new Error('network down'));
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    // Reaching here without an unhandled rejection failing the test is the assertion.
  });

  it('navigates to the tapped notification\'s chat via router.push', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'tok' });
    mockRegister.mockResolvedValue(undefined);
    let tapCallback!: (response: unknown) => void;
    mockAddResponseListener.mockImplementation((cb: (response: unknown) => void) => {
      tapCallback = cb;
      return { remove: jest.fn() };
    });
    renderHook(() => usePushNotifications());
    await waitFor(() => expect(mockAddResponseListener).toHaveBeenCalled());

    tapCallback({ notification: { request: { content: { data: { matchId: 'm42' } } } } });
    expect(mockPush).toHaveBeenCalledWith('/chat/m42');
  });

  it('does not navigate when the tapped notification carries no matchId', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'tok' });
    mockRegister.mockResolvedValue(undefined);
    let tapCallback!: (response: unknown) => void;
    mockAddResponseListener.mockImplementation((cb: (response: unknown) => void) => {
      tapCallback = cb;
      return { remove: jest.fn() };
    });
    renderHook(() => usePushNotifications());
    await waitFor(() => expect(mockAddResponseListener).toHaveBeenCalled());

    tapCallback({ notification: { request: { content: { data: {} } } } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('removes the notification-response listener on unmount', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'tok' });
    mockRegister.mockResolvedValue(undefined);
    const removeSpy = jest.fn();
    mockAddResponseListener.mockReturnValue({ remove: removeSpy });
    const { unmount } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(mockAddResponseListener).toHaveBeenCalled());

    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('does not register a token if the component unmounts before the permission check resolves', async () => {
    let resolvePermissions!: (v: { status: string }) => void;
    mockGetPermissions.mockReturnValue(new Promise((resolve) => { resolvePermissions = resolve; }));
    mockGetToken.mockResolvedValue({ data: 'tok' });
    mockRegister.mockResolvedValue(undefined);
    const { unmount } = renderHook(() => usePushNotifications());

    unmount();
    resolvePermissions({ status: 'granted' });
    await new Promise((r) => setTimeout(r, 0));

    expect(mockRegister).not.toHaveBeenCalled();
  });
});
