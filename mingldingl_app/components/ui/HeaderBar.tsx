import { View, Text, StyleSheet } from 'react-native';
import { Tap } from './Tap';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { i18n, isLatin } from '../../lib/i18n';
import { HEARTH_ENABLED } from '../../lib/world';
import { SectionDivider } from './SectionDivider';
import { Icon } from './Icon';
import { Glyph, type GlyphName } from './Glyph';
import { AtlasSigil } from '../world/AtlasSigil';

interface Props {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];
  glyph?: GlyphName;

  right?: ReactNode;

  children?: ReactNode;
}

export function HeaderBar({ title, showBack = true, onBack, icon, glyph, right, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Move 12: a room name in blackletter, once per screen, Latin only — no Google blackletter
  // carries Cyrillic, so Mongolian titles (and any Cyrillic title shown while the locale happens
  // to be `en`) stay in `FONTS.display` (Yeseva) until a Cyrillic cut is commissioned.
  const blackletter = i18n.locale === 'en' && isLatin(title);
  // The way home, everywhere but home itself — a hearth already standing on the hearth screen
  // would just point at the room it is in.
  const showHearthTap = HEARTH_ENABLED && pathname !== '/hearth';
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {showBack && (
            <Tap
              onPress={onBack ?? (() => router.back())}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('back')}
            >
              <Icon name="arrow-left" size={ICON_SIZES.xl} color={ACCENT.base} />
            </Tap>
          )}
          {icon && <Icon name={icon} size={ICON_SIZES.lg} style={styles.titleIcon} />}
          {/* Unlabelled: the title text right beside it already names the room. */}
          {glyph && <Glyph name={glyph} size={ICON_SIZES.lg} color={ACCENT.base} style={styles.titleIcon} />}
          {/* Two lines, because `adjustsFontSizeToFit` is iOS-only: on web and Android a long
              title (interpolated city names, the longer Mongolian copy) simply clipped —
              "Ulaanbaatar Leaderboard" rendered as "Ulaanbaatar Leaderb…". */}
          <Text
            style={[
              styles.title,
              blackletter && styles.titleBlackletter,
              right ? (blackletter ? styles.titleBlackletterCompact : styles.titleCompact) : null,
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {title}
          </Text>
        </View>
        <View style={styles.tail}>
          {showHearthTap && (
            <Tap
              onPress={() => router.push('/hearth')}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('go_home')}
              testID="header-hearth"
            >
              <Glyph name="hearth" size={ICON_SIZES.lg} color={ACCENT.base} />
            </Tap>
          )}
          <AtlasSigil />
          {right}
        </View>
      </View>
      <SectionDivider tint={ACCENT.base} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.lg, paddingBottom: SPACE.md, gap: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  tail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  titleIcon: { marginTop: SPACE.hair },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: INK.primary,
    letterSpacing: TRACKING.eyebrow,
    flexShrink: 1,
  },
  titleCompact: { fontSize: FONT_SIZES.xl, letterSpacing: TRACKING.wide },
  // Blackletter must not be letter-spaced (`TRACKING.body`, a whisper rather than the eyebrow's
  // wide air) — the hand already carries its own rhythm. Compact reuses `hero` rather than a
  // second dedicated blackletter step; see the note on `FONT_SIZES.roomName`.
  titleBlackletter: {
    fontFamily: FONTS.wordmark,
    fontSize: FONT_SIZES.roomName,
    letterSpacing: TRACKING.body,
  },
  titleBlackletterCompact: { fontSize: FONT_SIZES.hero, letterSpacing: TRACKING.body },
});
