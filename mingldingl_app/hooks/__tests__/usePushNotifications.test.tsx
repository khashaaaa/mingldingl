import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { usePushNotifications, destinationFor } from '../usePushNotifications';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

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
const mockSetChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const mockRegister = apiClient.push.register as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockPush = jest.fn();

describe('usePushNotifications — foreground notification handler (module-scope)', () => {
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

  // Registration is an authenticated call, so the hook waits for a session before making it.
  function signIn(userId = 'user-1') {
    useAuthStore.setState({ session: { user: { id: userId } } as never });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockIsDevice = true;
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockAddResponseListener.mockReturnValue({ remove: jest.fn() });
    mockSetChannel.mockResolvedValue(undefined);
    signIn();
  });

  afterEach(() => {
    Platform.OS = originalOS;
    useAuthStore.setState({ session: null });
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
  });

  /**
   * Signing out unregisters the token. The registration effect used to run once on mount, so the
   * next person to sign in on the same launch had no notifications at all until a force-quit.
   */
  it('re-registers when a different account signs in on the same launch', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockRegister.mockResolvedValue(undefined);
    const { rerender } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));

    signIn('user-2');
    rerender(undefined);

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
  });

  /**
   * A cold start restores the session asynchronously. Registering before it landed sent an
   * unauthenticated request whose 401 was swallowed, and that run got no pushes.
   */
  it('waits for a session before registering', async () => {
    useAuthStore.setState({ session: null });
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    const { rerender } = renderHook(() => usePushNotifications());

    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegister).not.toHaveBeenCalled();

    signIn();
    rerender(undefined);
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
  });

  /**
   * Android takes a notification's importance from its channel, not the message. Without one the
   * engine's `channelId: "default"` names nothing and every push lands in Expo's fallback channel
   * at default importance: no heads-up banner, no sound.
   */
  it('creates the high-importance Android channel the engine addresses', async () => {
    Platform.OS = 'android';
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockRegister.mockResolvedValue(undefined);
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockSetChannel).toHaveBeenCalled());
    expect(mockSetChannel.mock.calls[0][0]).toBe('default');
    expect(mockSetChannel.mock.calls[0][1].importance).toBe(4);
  });

  it('creates no channel on iOS, which has no such concept', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    mockRegister.mockResolvedValue(undefined);
    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockSetChannel).not.toHaveBeenCalled();
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

  // The engine tags every push with a `type` and this hook used to ignore it, sending a Flame
  // Rite proposal — whose entire subject is the video screen — to the chat instead.
  it("routes a Flame Rite proposal to the match's video screen, not its chat", async () => {
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

    tapCallback({
      notification: { request: { content: { data: { matchId: 'm7', type: 'flame_rite_proposed' } } } },
    });
    expect(mockPush).toHaveBeenCalledWith('/video/m7');
  });

  it('routes the match and message types to the chat', async () => {
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

    for (const type of ['match', 'message']) {
      tapCallback({ notification: { request: { content: { data: { matchId: 'm7', type } } } } });
    }
    expect(mockPush).toHaveBeenNthCalledWith(1, '/chat/m7');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/chat/m7');
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

describe('destinationFor', () => {
  it('sends a Flame Rite proposal to the video screen', () => {
    expect(destinationFor('flame_rite_proposed', 'm1')).toBe('/video/m1');
  });

  it('sends a Flame Rite acceptance to the video screen, where the proposer lights the call', () => {
    expect(destinationFor('flame_rite_accepted', 'm1')).toBe('/video/m1');
  });

  it('sends a Town Square start to the Town Square tab', () => {
    expect(destinationFor('townsquare_started', '')).toBe('/(tabs)/townsquare');
  });

  // Its own copy is "Open the activity for the details", and none of those details — the venue,
  // the time, the confirmation — are in the thread.
  it('sends a pledged encounter to the activity it is about, not the chat', () => {
    expect(destinationFor('date_confirmed', 'm1')).toBe('/activities/m1');
  });

  it('sends every other engine push type to the chat', () => {
    expect(destinationFor('match', 'm1')).toBe('/chat/m1');
    expect(destinationFor('message', 'm1')).toBe('/chat/m1');
    expect(destinationFor('match_ghosted', 'm1')).toBe('/chat/m1');
  });

  // A type this build has never heard of must still land somewhere useful.
  it('falls back to the chat for an unknown or absent type', () => {
    expect(destinationFor('some_future_type', 'm1')).toBe('/chat/m1');
    expect(destinationFor(undefined, 'm1')).toBe('/chat/m1');
  });
});
