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
