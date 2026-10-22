// The world is always night, but React Native lays Android's contrast scrim under the navigation
// bar by the phone's own mode: on a phone in light mode it painted a grey-white band under every
// screen (A51, 3-button navigation). No scrim, light buttons over the World Floor.
const { withAndroidStyles } = require('expo/config-plugins');

// name → the API level it arrived in
const ITEMS = {
  'android:enforceNavigationBarContrast': '29',
  'android:windowLightNavigationBar': '27',
  'android:windowLightStatusBar': '23',
};

module.exports = function withNightBars(config) {
  return withAndroidStyles(config, (c) => {
    const theme = c.modResults.resources.style.find((s) => s.$.name === 'AppTheme');
    theme.item = theme.item.filter((i) => !(i.$.name in ITEMS));
    for (const [name, api] of Object.entries(ITEMS)) {
      theme.item.push({ $: { name, 'tools:targetApi': api }, _: 'false' });
    }
    return c;
  });
};
