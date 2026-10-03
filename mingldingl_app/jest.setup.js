// Skia draws through native JSI bindings that do not exist under jest, so importing it from a
// component used to throw "Native Skia Module failed to correctly install JSI Bindings". Tests
// worked around it by mocking each Skia-using component by hand; this registers the library's
// own mock once instead, so any component is free to render its vfx in a test.
//
// This is the library's `jestSetup.js` restated rather than required, because its mock stops
// short of the Reanimated hooks the wait scenes (`components/vfx/scenes`) are built on: a path
// value here is a shared value holding no path, and the clock stands still. (Requiring the file
// as well would not work — its `jest.mock` runs after this hoisted one and replaces it.)
jest.mock('@shopify/react-native-skia', () => {
  jest.mock('@shopify/react-native-skia/lib/commonjs/Platform', () => {
    const Noop = () => undefined;
    return { OS: 'web', PixelRatio: 1, requireNativeComponent: Noop, resolveAsset: Noop, findNodeHandle: Noop, NativeModules: Noop, View: Noop };
  });
  jest.mock('@shopify/react-native-skia/lib/commonjs/skia/core/Font', () => ({
    useFont: () => null, matchFont: () => null, listFontFamilies: () => [], useFonts: () => null,
  }));
  const mock = require('@shopify/react-native-skia/lib/commonjs/mock').Mock(global.CanvasKit);
  return { ...mock, usePathValue: () => ({ value: null }), useClock: () => ({ value: 0 }) };
});

// expo-audio reaches for a native module at import time, so a component that merely *imports* the
// feedback layer used to fail the whole suite. Mocked once here, with shared spies, so any test
// can assert what the hold played without every test file restating this.
jest.mock('expo-audio', () => {
  const play = jest.fn();
  const seekTo = jest.fn(() => Promise.resolve());
  const remove = jest.fn();
  return {
    __player: { play, seekTo, remove },
    createAudioPlayer: jest.fn(() => ({ play, seekTo, remove })),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});

// TanStack Query schedules a garbage-collection timer for every cached query, and a test's
// QueryClient is never torn down, so those timers held each worker open after its suite ended
// ("A worker process has failed to exit gracefully"). Unreferenced, they still fire if a test
// waits for them but no longer keep the process alive. `setTimeout` is looked up at call time, so
// a test on fake timers still gets fake ones.
const { timeoutManager } = require('@tanstack/query-core');
const unref = (t) => { if (t && typeof t.unref === 'function') t.unref(); return t; };
timeoutManager.setTimeoutProvider({
  setTimeout: (cb, ms) => unref(setTimeout(cb, ms)),
  clearTimeout: (t) => clearTimeout(t),
  setInterval: (cb, ms) => unref(setInterval(cb, ms)),
  clearInterval: (t) => clearInterval(t),
});
