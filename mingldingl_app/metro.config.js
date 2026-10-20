// Expo's default Metro config, plus one switch for trying the app in Expo Go (EXPO_GO=1):
// Expo Go has no Agora, so react-native-agora resolves to a stub and only the Rite screens fail.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_GO === '1') {
  const resolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, name, platform) =>
    name === 'react-native-agora'
      ? { type: 'sourceFile', filePath: require.resolve('./scripts/expo-go-agora.js') }
      : (resolve ?? context.resolveRequest)(context, name, platform);
}

module.exports = config;
