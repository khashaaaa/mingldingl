jest.mock('expo-application', () => ({
  getAndroidId: () => 'test-android-id',
  getIosIdForVendorAsync: async () => 'test-ios-id',
}));
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});

// Reanimated 4 / Worklets run on the UI thread natively; tests use their shipped mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
// The shipped mock lacks useReducedMotion (tests run with motion on) and frame callbacks (no clock
// ticks under jest, so a timed ceremony holds its first frame). They go onto the mock module itself:
// expo-router's testing-library mocks Reanimated again with that same object.
Object.assign(require('react-native-reanimated/mock'), {
  useReducedMotion: () => false,
  useFrameCallback: () => ({ setActive: () => {}, isActive: false, callbackId: -1 }),
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// No native push module under jest: permission is undecided and nothing has been tapped.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  useLastNotificationResponse: () => null,
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { HIGH: 4 },
}));

// The World Floor is a Skia canvas (no JSI under jest); screens are tested over a bare floor.
jest.mock('@/design/world/WorldFloor', () => ({ WorldFloor: () => null }));
// The tier-up ceremony's light is Skia too.
jest.mock('@/features/ceremonies/TierUpLight', () => ({ TierUpBehind: () => null, TierUpOver: () => null }));
// A counting number shows its value at once under jest (no frames run there).
jest.mock('@/design/components/CountUp', () => {
  const { Txt } = require('@/design/components/Txt');
  return {
    CountUp: ({ value, format = String, delay: _d, ...p }) =>
      require('react').createElement(Txt, p, format(value)),
  };
});
// …and so is the glow behind flames and seals.
jest.mock('@/design/components/Glow', () => ({ Glow: () => null }));
jest.mock('@/design/components/Frost', () => ({ Frost: () => null }));
jest.mock('@/design/components/Candlelit', () => ({ Candlelit: () => null, CANDLELIT_PAD: 32 }));
jest.mock('@/design/components/FadedArt', () => ({ FadedArt: () => null }));
