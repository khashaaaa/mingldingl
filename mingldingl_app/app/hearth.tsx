import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { HeaderBar } from '../components/ui/HeaderBar';
import { AppCard } from '../components/ui/AppCard';
import { CardEyebrow } from '../components/ui/CardEyebrow';
import { CandleRow } from '../components/hearth/CandleRow';
import { GameButton } from '../components/ui/GameButton';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { StateBlock } from '../components/ui/StateBlock';
import { DawnFires, type DawnFire } from '../components/hearth/DawnFires';
import { Destinations } from '../components/hearth/Destinations';
import { SkyWindow } from '../components/hearth/SkyWindow';
import { GettingStartedCard } from '../components/progression/GettingStartedCard';
import { NextGatheringPill } from '../components/townsquare/NextGatheringPill';
import { useProfile } from '../hooks/useProfile';
import { useMatches } from '../hooks/useMatches';
import { useMyUserId } from '../hooks/useMyUserId';
import { useMilestones } from '../hooks/useMilestones';
import { useNowTicker } from '../hooks/useNowTicker';
import { useDailyMatchBudget } from '../hooks/useScore';
import { useGhostingWindows } from '../hooks/useRevealThresholds';
import { useScrollTail } from '../hooks/useScrollTail';
import { fireOf } from '../lib/fire';
import { useActiveFestival } from '../lib/festivals';
import { i18n } from '../lib/i18n';
import { useLocaleStore } from '../store/localeStore';
import { ordinalWord, threadDay } from '../lib/worldTime';
import { dayPhase } from '../lib/world/light';
import { ROOMS } from '../lib/world/rooms';
import { FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, RADIUS, SPACE } from '../lib/theme';
import type { Match } from '../models/match';

/**
 * Home (Sealed Fire move 6). The one screen that is a *place* rather than a task: the real sky in
 * its window, today counted as a dawn since you joined, the day's summons standing in wax, and the
 * fires that were judged at this dawn. Everything else on it is a way out — and the law under the
 * rows says so, because the tab bar still stands and nothing here is the only door to anywhere.
 *
 * Two things that used to live elsewhere have come home: the First Steps board (off the character
 * sheet) and the next gathering's pill (off the Quest Log). Both keep their own visibility rules;
 * neither was rewritten to move.
 *
 * Title comes from the `ROOMS` table rather than a key of this screen's own — the room's name is
 * the header's name, and a second copy of "The Hearth" is a copy that can drift.
 */

/** Assumed width until `onLayout` reports the real one — the pattern `app/progression.tsx` uses
 *  for its own sky. */
const FALLBACK_SKY_WIDTH = 320;

/** The three days of Tsagaan Sar, whichever year's window is running. */
const WHITE_MOON_PREFIX = 'tsagaan-sar';

/**
 * What a thread is allowed to call the other person at its current reveal level. The Quest Log
 * has its own placeholder key (`mystery_match_name`) for the same idea; a sealed thread uses
 * `unknown_name` instead so the two contexts can read differently if either one's copy diverges.
 *
 * The seal is tested **first**, the order `QuestTile` already keeps: "A name struck" is a fact about
 * a person the reveal ladder has not handed over yet, so a sealed thread whose partner has since
 * deleted must still read as sealed rather than announce that someone left.
 */
function fireName(match: Match): string {
  if (match.revealLevel < 2) return i18n.t('unknown_name');
  if (match.otherUser.isDeleted) return i18n.t('deleted_user');
  return match.otherUser.displayName ?? i18n.t('unknown_name');
}

export default function HearthScreen() {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  // `useMatches` is `silentError`, so nothing else on the app will report a failed load — this
  // screen has to, or an empty ledger reads as "you have no threads".
  const { data: matches, isLoading: matchesLoading, isError: matchesError, refetch: refetchMatches } = useMatches();
  const myId = useMyUserId();
  const windows = useGhostingWindows();
  const { milestones } = useMilestones();
  const dailyBudget = useDailyMatchBudget();
  const festival = useActiveFestival();
  const tail = useScrollTail();
  // A fire turns over with the clock alone, and so does the sky — both need `now` to change while
  // the screen sits open. Same ticker the Quest Log and the chat read.
  const now = useNowTicker();
  const [skyWidth, setSkyWidth] = useState(FALLBACK_SKY_WIDTH);

  const phase = dayPhase(new Date(now));
  const whiteMoon = festival?.key.startsWith(WHITE_MOON_PREFIX) ?? false;

  // Which dawn this is, counted the way a thread's days are counted — local midnights since you
  // joined, the joining day being the first. `ordinalWord` words it to the thirty-first and falls
  // back to a suffixed numeral past that.
  const dawnEyebrow = profile?.joinedAt
    ? i18n.t('hearth_dawn', { dawn: ordinalWord(threadDay(new Date(now).toISOString(), profile.joinedAt)) })
    : i18n.t('hearth_dawn_unknown');

  const fires: DawnFire[] = (matches ?? []).map((match) => ({
    id: match.matchId,
    name: fireName(match),
    fire: fireOf(match, myId, now, windows),
  }));

  function onSkyLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== skyWidth) setSkyWidth(w);
  }

  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t(ROOMS.hearth.key)} showBack={false} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tail }]}>
        <AppCard hero style={styles.hearthCard}>
          <View onLayout={onSkyLayout}>
            <SkyWindow phase={phase} width={skyWidth} whiteMoon={whiteMoon} />
          </View>
          <View style={styles.cardBody}>
            {/* `hearth_dawn_unknown` is for a *loaded* profile with no joining day; a profile still
                in flight has no dawn to name yet, and saying "a new dawn" to a returning user would
                be the app inventing one. */}
            {profileLoading
              ? <Skeleton width="45%" height={FONT_SIZES.xs} style={styles.eyebrowSkeleton} />
              : <CardEyebrow>{dawnEyebrow}</CardEyebrow>}
            {whiteMoon ? (
              <>
                <CardEyebrow>{i18n.t('hearth_white_moon')}</CardEyebrow>
                <Text style={styles.appVoice}>{i18n.t('hearth_white_moon_sub')}</Text>
              </>
            ) : (
              <Text style={styles.appVoice}>{i18n.t('hearth_sky')}</Text>
            )}
            {dailyBudget && (
              <View style={styles.waxBlock}>
                <CandleRow remaining={dailyBudget.remaining} budget={dailyBudget.budget} />
                <Text style={styles.appVoice}>{i18n.t('hearth_candles')}</Text>
              </View>
            )}
          </View>
        </AppCard>

        {profile && (
          <GettingStartedCard
            isProfileComplete={profile.isProfileComplete}
            achievedMilestoneIds={milestones.filter((m) => m.achievedAt).map((m) => m.id ?? '')}
            onCompleteProfile={() => router.push('/edit-profile')}
          />
        )}
        <NextGatheringPill />

        <View style={styles.section}>
          <Destinations />
        </View>

        <View style={styles.section}>
          {/* The eyebrow stands in all three states: the ledger is the same part of the screen
              whether it is waiting, broken or empty. */}
          <CardEyebrow>{i18n.t('hearth_judged')}</CardEyebrow>
          {matchesLoading && (
            <SkeletonRows count={3} row={() => (
              <View style={styles.fireRowShape}>
                <Skeleton width={ICON_SIZES.md} height={ICON_SIZES.md} radius={RADIUS.pill} />
                <Skeleton width="72%" height={FONT_SIZES.md} />
              </View>
            )} />
          )}
          {!matchesLoading && matchesError && (
            // `framed` rather than bare: an unframed block is `flex: 1` and would collapse to no
            // height inside this scroll content. Ink, not forged — the hearth spends no forge.
            <StateBlock framed tone="danger" icon="alert-circle-outline" title={i18n.t('screen_load_error')}>
              <GameButton variant="ink" size="compact" onPress={() => refetchMatches()}>{i18n.t('retry')}</GameButton>
            </StateBlock>
          )}
          {!matchesLoading && !matchesError && <DawnFires fires={fires} />}
        </View>

        <Text style={styles.law}>{i18n.t('hearth_law')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the world floor paints behind every screen, an opaque container would hide it.
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingTop: SPACE.sm },
  // `overflow: hidden` so the sky's own corners are the card's corners.
  hearthCard: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, overflow: 'hidden' },
  cardBody: { padding: SPACE.lg, gap: SPACE.sm },
  waxBlock: { marginTop: SPACE.sm, gap: SPACE.sm },
  // Holds the eyebrow's own bottom margin, so the card does not reflow when the dawn lands.
  eyebrowSkeleton: { marginBottom: SPACE.sm },
  // A judged fire's row: its mark, then its sentence.
  fireRowShape: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  section: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  // Italic is the app speaking — the sky, the wax and the law are all the world stating itself.
  appVoice: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, lineHeight: LEADING.md, color: INK.dim },
  law: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.sm,
    color: INK.dim,
    textAlign: 'center',
    paddingHorizontal: SPACE.gutter,
    paddingBottom: SPACE.lg,
  },
});
