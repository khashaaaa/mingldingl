// Skia draws through native JSI bindings that do not exist under jest, so importing it from a
// component used to throw "Native Skia Module failed to correctly install JSI Bindings". Tests
// worked around it by mocking each Skia-using component by hand; this registers the library's
// own mock once instead, so any component is free to render its vfx in a test.
require('@shopify/react-native-skia/jestSetup.js');

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
