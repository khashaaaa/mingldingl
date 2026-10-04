import { View, Text, Image, StyleSheet } from 'react-native';
import { Tap } from './Tap';
import { type ReactNode } from 'react';
import { useRouter, usePathname, useRootNavigationState } from 'expo-router';
import { goHome, stackHas, goBack } from '../../lib/navigation';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
import { i18n, isLatin } from '../../lib/i18n';
import { HEARTH_ENABLED } from '../../lib/world';
import { SectionDivider } from './SectionDivider';
import { Icon } from './Icon';
import { Glyph } from './Glyph';
import { BRUSH_POOLS, BRUSH_POOL_ASPECT } from './brushImages';

/**
 * How far a title may shrink to stay on one line, as a last resort. Every fixed title fits at full
 * size on a 411pt phone (the A51); this only catches a narrower phone and the titles that come
 * from data — a name, a venue, a quiz.
 */
const MIN_TITLE_SCALE = 0.6;

interface Props {
  title: string;
  showBack?: boolean;
  onBack?: () => void;

  right?: ReactNode;

  /**
   * False hides the way-home tap — the title, back arrow and `right` slot are
   * unaffected. A screen holding a live call (Town Square's round) must not offer an exit that
   * leaves the call mounted: `router.push` keeps the screen alive underneath, so
   * `AgoraVideoCall`'s `leaveChannel()` cleanup never runs and the camera/mic keep publishing
   * while the user is elsewhere with no controls. Defaults to `true`: only a live-call screen opts out.
   */
  chrome?: boolean;

  children?: ReactNode;
}

/** The blackletter's ink sits low in its line box: on the A51 its centre read ~3dp below the back
 *  arrow and the tail icons. Lifted by a share of its size, so every fit step stays level. */
const BLACKLETTER_LIFT = 0.07;

/** The ink pool under a room's name: wide enough to sit under the longest title, a little past it. */
const POOL_WIDTH = 300;
const POOL_HEIGHT = POOL_WIDTH / BRUSH_POOL_ASPECT;

/** The same room always gets the same pool, and neighbouring rooms usually differ. */
export function poolFor(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h % BRUSH_POOLS.length;
}

/**
 * The top of every screen: back, the room's name, the way home, and the screen's own control.
 *
 * Kept to that on purpose (2026-10-04). It used to also carry the room's glyph beside the title,
 * the atlas knot, and a second knot in the rule under it — up to six marks before any content,
 * two of them the same knot. The title already names the room (and the floor's light and carvings
 * say it again), and the atlas now opens from the hearth, the centre of the map, one tap away.
 * The rule under it got its knot back the same day: it was the only gold rule in the app without
 * one, and read as a different ornament rather than a quieter one.
 */
export function HeaderBar({ title, showBack = true, onBack, right, children, chrome = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Whether a hearth is already somewhere in the stack, so the way home returns to it rather than
  // stacking a second one (hearth → satchel → home → satchel → home… grew without end).
  const hearthOpen = stackHas(useRootNavigationState(), 'hearth');
  // Move 12: a room name in blackletter, once per screen, Latin only — no Google blackletter
  // carries Cyrillic, so Mongolian titles (and any Cyrillic title shown while the locale happens
  // to be `en`) stay in `FONTS.display` (Yeseva) until a Cyrillic cut is commissioned.
  const blackletter = i18n.locale === 'en' && isLatin(title);
  // The way home, everywhere but home itself — a hearth already standing on the hearth screen
  // would just point at the room it is in. Also gated on `chrome`: see its doc comment above.
  const showHearthTap = HEARTH_ENABLED && pathname !== '/hearth' && chrome;
  // One size on every screen (2026-10-04). It used to drop a size whenever the screen had a
  // right-hand control and then step down again until the title fitted, measured by a loop that
  // over-stepped on Android — five tab titles came out at five sizes from 22 to 34.
  const titleStyle = [styles.title, blackletter && styles.titleBlackletter];
  const size = blackletter ? FONT_SIZES.headerTitle : FONT_SIZES.title;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {showBack && (
            <Tap
              onPress={onBack ?? (() => goBack(router))}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('back')}
            >
              <Icon name="arrow-left" size={ICON_SIZES.xl} color={ACCENT.base} />
            </Tap>
          )}
          {/* A wash of ink puddled under the name, darker at its dried rim (`scripts/gen-brush.js`). */}
          <Image source={BRUSH_POOLS[poolFor(title)]} style={[styles.pool, showBack && styles.poolAfterBack]} resizeMode="stretch" accessible={false} testID="header-pool" />
          <Text
            style={[titleStyle, blackletter && { transform: [{ translateY: -size * BLACKLETTER_LIFT }] }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={MIN_TITLE_SCALE}
          >
            {title}
          </Text>
        </View>
        <View style={styles.tail}>
          {showHearthTap && (
            <Tap
              onPress={() => goHome(router, hearthOpen)}
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
  pool: { position: 'absolute', left: -SPACE.xl, top: '50%', marginTop: -POOL_HEIGHT / 2, width: POOL_WIDTH, height: POOL_HEIGHT },
  poolAfterBack: { left: 34 - SPACE.xl },
  tail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
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
  // Blackletter must not be letter-spaced (`TRACKING.body`, a whisper rather than the eyebrow's
  // wide air) — the hand already carries its own rhythm.
  titleBlackletter: {
    fontFamily: FONTS.wordmark,
    fontSize: FONT_SIZES.headerTitle,
    letterSpacing: TRACKING.body,
  },
});
