// Stand-in for react-native-agora under Expo Go (see metro.config.js). Enums read as 0; starting
// a call throws, so the Rite fails as a call would and the rest of the app runs.
const { View } = require('react-native');

const anyEnum = new Proxy({}, { get: () => 0 });

module.exports = new Proxy(
  {
    RtcSurfaceView: View,
    createAgoraRtcEngine: () => {
      throw new Error('Video calls need the development build, not Expo Go');
    },
  },
  { get: (stub, key) => (key in stub ? stub[key] : anyEnum) },
);
