const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-secure-store' && platform === 'web') {
    return { filePath: require.resolve('./shims/secure-store.web.js'), type: 'sourceFile' };
  }
  // zustand's web/ESM export references `import.meta` (for an optional devtools
  // connector we never use); resolving it the same way native does (the
  // "react-native" exports condition -> CJS) avoids that on web too.
  if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
    const resolveAs = defaultResolveRequest ?? context.resolveRequest;
    return resolveAs(context, moduleName, platform === 'web' ? 'ios' : platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
