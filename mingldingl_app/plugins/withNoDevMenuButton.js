// The dev menu's floating "Tools" button sits over every room header's trailing action (it hid
// "Edit your character" from taps and from Maestro). Open the menu with a shake or Ctrl+M instead.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoDevMenuButton(config) {
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'EXDevMenuShowFloatingActionButton', 'false');
    return c;
  });
};
