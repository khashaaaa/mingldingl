import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { SectionDivider } from './SectionDivider';
import { Icon } from './Icon';

interface Props {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];

  right?: ReactNode;

  children?: ReactNode;
}

export function HeaderBar({ title, showBack = true, onBack, icon, right, children }: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {showBack && (
            <TouchableOpacity
              onPress={onBack ?? (() => router.back())}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('back')}
            >
              <Icon name="arrow-left" size={22} color={COLORS.gold} />
            </TouchableOpacity>
          )}
          {icon && <Icon name={icon} size={20} style={styles.titleIcon} />}
          {/* Two lines, because `adjustsFontSizeToFit` is iOS-only: on web and Android a long
              title (interpolated city names, the longer Mongolian copy) simply clipped —
              "Ulaanbaatar Leaderboard" rendered as "Ulaanbaatar Leaderb…". */}
          <Text
            style={[styles.title, right ? styles.titleCompact : null]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
        </View>
        {right}
      </View>
      <SectionDivider tint={COLORS.gold} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  titleIcon: { marginTop: 2 },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: FONTS.displayBlack,
    fontSize: 24,
    color: COLORS.text,
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  titleCompact: { fontSize: 19, letterSpacing: 1 },
});
