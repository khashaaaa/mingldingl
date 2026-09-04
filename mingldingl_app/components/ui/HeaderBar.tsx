import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';
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
              <Icon name="arrow-left" size={ICON_SIZES.xl} color={COLORS.gold} />
            </TouchableOpacity>
          )}
          {icon && <Icon name={icon} size={ICON_SIZES.lg} style={styles.titleIcon} />}
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
  wrap: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.md, gap: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  titleIcon: { marginTop: SPACE.hair },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: FONTS.displayBlack,
    fontSize: FONT_SIZES.title,
    color: COLORS.text,
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  titleCompact: { fontSize: FONT_SIZES.xl, letterSpacing: 1 },
});
