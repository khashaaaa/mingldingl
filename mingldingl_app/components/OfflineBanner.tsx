import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{i18n.t('offline_banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: COLORS.emberDark,
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    textAlign: 'center',
  },
});
