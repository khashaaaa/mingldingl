import { Text, StyleSheet } from 'react-native';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

// Unlike NudgeToast (auto-dismisses after ~3s), this stays up for as long as
// useNetworkStatus reports offline and disappears the instant it doesn't —
// it's reporting live device state, not a one-shot event.
export function OfflineBanner() {
  return (
    <Text style={styles.banner} accessibilityLiveRegion="polite">
      {i18n.t('offline_banner')}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: COLORS.ember,
    color: '#fff',
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
