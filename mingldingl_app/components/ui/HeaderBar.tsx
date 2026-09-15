import { View, Text, StyleSheet } from 'react-native';
import { Tap } from './Tap';
import { useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { i18n, isLatin } from '../../lib/i18n';
import { HEARTH_ENABLED } from '../../lib/world';
import { SectionDivider } from './SectionDivider';
import { Icon } from './Icon';
import { Glyph, type GlyphName } from './Glyph';
import { AtlasSigil } from '../world/AtlasSigil';

/** The sizes a title steps through, as fractions of its style's size, until it fits on one line. */
const FIT_SCALES = [1, 0.88, 0.76, 0.66, 0.58] as const;

interface Props {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];
  glyph?: GlyphName;

  right?: ReactNode;

  /**
   * False hides the way-home tap and `AtlasSigil` — the title, back arrow and `right` slot are
   * unaffected. A screen holding a live call (Town Square's round) must not offer an exit that
   * leaves the call mounted: `router.push` keeps the screen alive underneath, so
   * `AgoraVideoCall`'s `leaveChannel()` cleanup never runs and the camera/mic keep publishing
   * while the user is elsewhere with no controls. `AtlasSigil`'s own comment already says the
   * video call is deliberately kept off the chrome for the same reason — this just extends that
   * rule to the header's own hearth tap. Defaults to `true`: only a live-call screen opts out.
   */
  chrome?: boolean;

  children?: ReactNode;
}

export function HeaderBar({ title, showBack = true, onBack, icon, glyph, right, children, chrome = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Move 12: a room name in blackletter, once per screen, Latin only — no Google blackletter
  // carries Cyrillic, so Mongolian titles (and any Cyrillic title shown while the locale happens
  // to be `en`) stay in `FONTS.display` (Yeseva) until a Cyrillic cut is commissioned.
  const blackletter = i18n.locale === 'en' && isLatin(title);
  // The way home, everywhere but home itself — a hearth already standing on the hearth screen
  // would just point at the room it is in. Also gated on `chrome`: see its doc comment above.
  const showHearthTap = HEARTH_ENABLED && pathname !== '/hearth' && chrome;
  const titleStyle = StyleSheet.flatten([
    styles.title,
    blackletter && styles.titleBlackletter,
    right ? (blackletter ? styles.titleBlackletterCompact : styles.titleCompact) : null,
  ]);
  const baseSize = titleStyle.fontSize ?? FONT_SIZES.title;
  // Keyed by the title, so a screen whose title changes (a venue loading its name) fits afresh.
  const [fit, setFit] = useState({ title, step: 0 });
  const step = fit.title === title ? fit.step : 0;
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
          {/* One line, stepped down to fit. Wrapping a 48pt blackletter title onto a second line
              doubled the header's height and left the back arrow and tail icons floating beside
              the middle of a two-line block, and `adjustsFontSizeToFit` on Android shrank the
              glyphs but kept the two-line height. Each layout that still wraps drops one step;
              `numberOfLines={2}` stays only as the floor for a title too long for the last step. */}
          <Text
            style={[titleStyle, { fontSize: baseSize * FIT_SCALES[step] }]}
            numberOfLines={2}
            onTextLayout={(e) => {
              if (e.nativeEvent.lines.length > 1 && step < FIT_SCALES.length - 1) {
                setFit({ title, step: step + 1 });
              }
            }}
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
              style={styles.hearthBtn}
            >
              {/* Nudged up a hair: the hearth drawing sits low in its box, and on hardware it read
                  2dp below the back arrow and the knot beside it. */}
              <Glyph name="hearth" size={ICON_SIZES.lg} color={ACCENT.base} style={styles.hearthGlyph} />
            </Tap>
          )}
          {chrome && <AtlasSigil />}
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
  // At least the back button's 44pt, so a screen without one (the hearth) puts its divider at the
  // same height as every other screen instead of jumping up when a short title sets the row.
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  tail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  titleIcon: { marginTop: SPACE.hair },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  // The glyph is 20pt; the target is the platform's 44pt minimum around it.
  hearthBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hearthGlyph: { marginTop: -SPACE.hair },
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
