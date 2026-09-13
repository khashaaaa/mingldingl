import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { HeaderBar } from '../components/ui/HeaderBar';
import { SkeletonRows, Skeleton } from '../components/ui/Skeleton';
import { SatchelRow } from '../components/satchel/SatchelRow';
import type { Material } from '../components/ui/MaterialMark';
import type { GlyphName } from '../components/ui/Glyph';
import { useProfile } from '../hooks/useProfile';
import { useMatches } from '../hooks/useMatches';
import { useDailyMatchBudget } from '../hooks/useScore';
import { usePendingShips } from '../hooks/usePendingShips';
import { useTownSquareSession } from '../hooks/useTownSquareSession';
import { useMembership } from '../hooks/useMembership';
import { useInventory } from '../hooks/useInventory';
import { useRevealLadder } from '../hooks/useRevealThresholds';
import { itemLabel } from '../lib/tiers';
import { oathLabel } from '../components/OathSigil';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { countWord } from '../lib/worldTime';
import { useScrollTail } from '../hooks/useScrollTail';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, RADIUS, SPACE } from '../lib/theme';

/**
 * What the Satchel holds: an object per row, in the board's own order. Every field below is read
 * straight off a hook already serving some other screen — the Satchel names nothing the rules
 * have not already decided, it only gathers the nine into one place.
 */
interface Row {
  key: string;
  material: Material;
  glyph: GlyphName;
  name: string;
  line: string;
  to: Href;
}

const SKELETON_ROW_COUNT = 9;

/**
 * i18n-js reserves `count` on `TranslateOptions` as a `number`, for its own object-keyed
 * pluralize() hook. These keys never take that path — `_one`/`_none` are chosen explicitly below,
 * and `%{count}` is plain interpolated text either way (`interpolate.js` calls `.toString()` on
 * whatever is passed) — so the cast only satisfies a type that does not describe how the field is
 * actually used here.
 */
function countText(n: number): number {
  return countWord(n) as unknown as number;
}

/**
 * The read-only inventory (Sealed Fire move — Wave 4 Task 9). Every row here already exists as a
 * rule enforced somewhere else in the app; this is the first screen to lay all nine side by side
 * and let a tap go straight to the room that rule lives in. Nothing is found, bought, dropped or
 * stacked — the footer says so, and there is no button on this screen that could make it not so.
 */
export default function SatchelScreen() {
  useLocaleStore((s) => s.locale);
  const tail = useScrollTail();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const dailyBudget = useDailyMatchBudget();
  const { pendingShips } = usePendingShips();
  const { session } = useTownSquareSession();
  const { currentLevel } = useMembership();
  const { items } = useInventory();

  const loading = profileLoading || matchesLoading;

  const remaining = dailyBudget?.remaining ?? 0;
  const budget = dailyBudget?.budget ?? 0;

  const arrowCount = pendingShips.length;

  // A gathering only reads as "called" once the next-session query names one; `isRsvpd` on that
  // same object is what "lit" means for it.
  const gatheringCalled = !!session?.sessionId;
  const lanternLit = gatheringCalled && session!.isRsvpd;

  const oath = profile?.oath ?? null;
  const oathProven = profile?.oathProven ?? false;
  const oathHeld = profile?.oathEncountersHeld ?? null;
  const oathNeeded = profile?.oathEncountersNeeded ?? null;
  // Both fields are nullable on purpose (`models/user.ts`) — `OathCard.tsx` and
  // `useHonourProgress.ts` both refuse to show a count until the engine has sent both, rather
  // than defaulting either to 0, which would read as "0 of 0 kept" — a sworn oath that looks
  // already fulfilled instead of merely uncounted yet.
  const hasOathProgress = oathHeld != null && oathNeeded != null;

  // Silver and Gold are the two floors above the Yard (`floor_Silver`/`floor_Gold`) — the key is
  // whatever opens the one the player is standing in, so a Free rank simply does not hold it.
  const keyHeld = currentLevel === 'Silver' || currentLevel === 'Gold';

  const wornItem = items.find((it) => it.equipped);

  // "Active" is the engine's own status for a thread that has not ghosted, completed or been
  // unmatched — the only kind a seal can still be unbroken on.
  const activeMatches = (matches ?? []).filter((m) => m.status === 'Active');
  // Live, not a one-off read: `useRevealLadder` re-renders this screen if the ladder hydrates
  // after it is already open, the same way `SealsSheet`/`app/edit-profile.tsx`/
  // `app/chat/[matchId].tsx` all read it.
  const ladder = useRevealLadder();
  const totalSeals = activeMatches.reduce(
    (sum, m) => sum + Math.max(0, ladder.length - m.revealLevel),
    0,
  );
  const threadCount = activeMatches.length;

  const rows: Row[] = [
    {
      key: 'candles',
      material: 'wax',
      glyph: 'candle',
      name: i18n.t('satchel_candles'),
      line: i18n.t('satchel_candles_line', { remaining, budget }),
      to: '/(tabs)/discover',
    },
    {
      key: 'arrows',
      material: 'wood',
      glyph: 'pledge',
      name: i18n.t('satchel_arrows'),
      line: arrowCount === 0
        ? i18n.t('satchel_arrows_none')
        : arrowCount === 1
          ? i18n.t('satchel_arrows_one')
          : i18n.t('satchel_arrows_line', { count: countText(arrowCount) }),
      to: '/(tabs)/matches',
    },
    {
      key: 'lantern',
      material: 'bronze',
      glyph: 'lantern',
      name: i18n.t('satchel_lantern'),
      line: !gatheringCalled
        ? i18n.t('satchel_lantern_none')
        : lanternLit
          ? i18n.t('satchel_lantern_lit')
          : i18n.t('satchel_lantern_unlit'),
      to: '/(tabs)/townsquare',
    },
    {
      key: 'oath',
      material: 'bronze',
      glyph: 'seal',
      name: i18n.t('satchel_oath'),
      line: !oath
        ? i18n.t('satchel_oath_none')
        : oathProven
          ? i18n.t('satchel_oath_proven', { oath: oathLabel(oath) })
          : hasOathProgress
            ? i18n.t('satchel_oath_line', { oath: oathLabel(oath), held: oathHeld, needed: oathNeeded })
            : i18n.t('satchel_oath_sworn', { oath: oathLabel(oath) }),
      to: '/(tabs)/profile',
    },
    {
      key: 'key',
      material: 'gold',
      glyph: 'knot',
      name: i18n.t('satchel_key'),
      // The floor name is data keyed by the same `floor_${level}` family `app/membership.tsx`
      // already builds its own labels from, so the two never drift into naming the same floor
      // two different things.
      line: keyHeld
        ? i18n.t('satchel_key_held', { floor: i18n.t(`floor_${currentLevel}`) })
        : i18n.t('satchel_key_none'),
      to: '/membership',
    },
    {
      key: 'word',
      material: 'bronze',
      glyph: 'letters',
      name: i18n.t('satchel_word'),
      line: profile?.referralCode || i18n.t('satchel_word_none'),
      to: '/(tabs)/profile',
    },
    {
      key: 'honour',
      material: 'gold',
      glyph: 'flame',
      name: i18n.t('satchel_honour'),
      line: wornItem ? itemLabel(wornItem.itemId) : i18n.t('satchel_honour_none'),
      to: '/(tabs)/profile',
    },
    {
      key: 'seals',
      material: 'wax',
      glyph: 'seals',
      name: i18n.t('satchel_seals'),
      line: threadCount === 0
        ? i18n.t('satchel_seals_none')
        : threadCount === 1
          ? i18n.t('satchel_seals_one_thread', { seals: countWord(totalSeals) })
          : i18n.t('satchel_seals_line', { seals: countWord(totalSeals), threads: countWord(threadCount) }),
      to: '/(tabs)/matches',
    },
    {
      key: 'card',
      material: 'parchment',
      glyph: 'gem',
      name: i18n.t('satchel_card'),
      line: i18n.t('satchel_card_line'),
      to: '/(tabs)/profile',
    },
  ];

  // Only candles and arrows always have a fact worth stating (even "none"); the lantern only
  // earns a line here when it is lit — an unlit or uncalled lantern is not news, and saying so
  // twice (once in its own row, once in the recap) would be the app repeating itself.
  const summaryParts = [
    remaining === 1
      ? i18n.t('satchel_sum_candles_one')
      : i18n.t('satchel_sum_candles', { count: countText(remaining) }),
    arrowCount === 1
      ? i18n.t('satchel_sum_arrows_one')
      : i18n.t('satchel_sum_arrows', { count: countText(arrowCount) }),
    ...(lanternLit ? [i18n.t('satchel_sum_lantern')] : []),
  ];

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t('satchel_title')} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        <Text style={styles.sub}>{i18n.t('satchel_sub')}</Text>
        {loading ? (
          <SkeletonRows count={SKELETON_ROW_COUNT} row={() => (
            <View style={styles.skeletonRow}>
              <Skeleton width={ICON_SIZES.lg} height={ICON_SIZES.lg} radius={RADIUS.pill} />
              <View style={styles.skeletonText}>
                <Skeleton width="45%" height={FONT_SIZES.lg} />
                <Skeleton width="70%" height={FONT_SIZES.sm} />
              </View>
            </View>
          )} />
        ) : (
          <>
            <View>
              {rows.map((row) => (
                <SatchelRow
                  key={row.key}
                  testID={`satchel-row-${row.key}`}
                  material={row.material}
                  glyph={row.glyph}
                  name={row.name}
                  line={row.line}
                  to={row.to}
                />
              ))}
            </View>
            <Text style={styles.summary}>{summaryParts.join(' ')}</Text>
          </>
        )}
        <Text style={styles.law}>{i18n.t('satchel_law')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the world floor paints behind every screen, an opaque container would hide it.
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACE.gutter, paddingTop: SPACE.sm },
  sub: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, lineHeight: LEADING.md, color: INK.dim, marginBottom: SPACE.lg },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  skeletonText: { flex: 1, gap: SPACE.xs },
  summary: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    color: INK.dim,
    marginTop: SPACE.lg,
  },
  law: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.sm,
    color: INK.dim,
    textAlign: 'center',
    marginTop: SPACE.xl,
    paddingBottom: SPACE.lg,
  },
});
