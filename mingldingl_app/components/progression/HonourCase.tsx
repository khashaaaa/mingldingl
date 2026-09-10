import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { GameButton } from '../ui/GameButton';
import { SectionDivider } from '../ui/SectionDivider';
import { AlertModal } from '../modals/AlertModal';
import { ChestModal } from '../modals/ChestModal';
import { SheetModal } from '../modals/SheetModal';
import { ChestBurst } from '../vfx/ChestBurst';
import { Icon } from '../ui/Icon';
import { useInventory } from '../../hooks/useInventory';
import { useMilestones } from '../../hooks/useMilestones';
import { useOptimisticScoreBump } from '../../hooks/useOptimisticScoreBump';
import { useHonourProgress, type HonourProgress } from '../../hooks/useHonourProgress';
import { useIgnition } from '../../hooks/useIgnition';
import { useAuthStore } from '../../store/authStore';
import {
  HONOUR_DEED_KEYS, HONOUR_ICONS, HONOUR_IDS, HONOUR_LORE_KEYS, METAL_COLORS, THREAD_HONOUR_IDS,
  itemLabel, type HonourId,
} from '../../lib/tiers';
import { formatDate } from '../../lib/formatDate';
import { i18n, tKey } from '../../lib/i18n';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { signal } from '../../lib/world/feedback';
import {
  COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE_HEIGHTS, RADIUS, SPACE, circle, tint,
} from '../../lib/theme';

interface HeldHonour {
  itemId?: string | null;
  rarity?: string | null;
  equipped?: boolean;
  acquiredAt?: string | null;
}

/** The hall is three rows: the honours with stakes, the thread triptych, the honours of habit. */
const ROWS: readonly (readonly HonourId[])[] = [
  ['title_oathkeeper', 'title_flamekeeper', 'title_sealbreaker'],
  THREAD_HONOUR_IDS,
  ['title_allycaller', 'title_trueword', 'title_sevendawns'],
];

const CHIP = 36;
const IGNITE_MS = 700;
const BREATH_MS = 1200;
const SWEEP_MS = 900;

/**
 * The trophy hall: every honour the engine can grant, always all nine, lit in its metal once the
 * deed is done and dark with the deed as the hint until then. Tapping a lit honour wears it as the
 * title other people see; a long press on any slot opens its story. An honour that is granted
 * while the hall is open catches fire in place — `useIgnition` tells the slot it just arrived —
 * and a dark slot whose deed the app can count shows how far along it is.
 */
export function HonourCase() {
  const { items, equip, isEquipping, isLoading } = useInventory();
  const { milestones, open, isOpening } = useMilestones();
  const progress = useHonourProgress();
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const bumpScore = useOptimisticScoreBump();
  const setPendingTierUp = useAuthStore((s) => s.setPendingTierUp);
  const [chest, setChest] = useState<{ xp: number; deferredTierUp?: string | null } | null>(null);
  const [chestVisible, setChestVisible] = useState(false);
  const [failAlert, setFailAlert] = useState(false);
  const [story, setStory] = useState<HonourId | null>(null);

  async function handleOpenMilestone(id: string) {
    try {
      const res = await open(id);
      if (!res.alreadyOpened) {
        bumpScore(res.awarded ?? 0);
        const deferredTierUp = useAuthStore.getState().pendingTierUp;
        if (deferredTierUp) setPendingTierUp(null);
        setChest({ xp: res.awarded ?? 0, deferredTierUp });
        setChestVisible(true);
      }
    } catch { setFailAlert(true); }
  }

  const heldById = new Map<string, HeldHonour>(
    items.filter((it) => it.itemType === 'Title' && it.itemId).map((it) => [it.itemId!, it]),
  );
  const heldIds = HONOUR_IDS.filter((id) => heldById.has(id));
  const ignited = useIgnition(isLoading ? undefined : heldIds);

  // One note per batch of ignitions, not one per slot: two honours landing in the same fetch are
  // one moment, and the honour chime rewinds itself anyway.
  useEffect(() => {
    if (ignited.length > 0) signal('honour');
  }, [ignited.length]);

  const unopened = milestones.filter((m) => m.achievedAt && !m.openedAt);
  const storyHeld = story ? heldById.get(story) : undefined;

  function wear(id: HonourId) {
    if (!heldById.has(id) || isEquipping) return;
    equip(id);
  }

  function renderSlot(id: HonourId) {
    return (
      <HonourSlot
        key={id}
        id={id}
        held={heldById.get(id)}
        ignited={ignited.includes(id)}
        progress={progress[id]}
        animate={animate}
        onPress={() => wear(id)}
        onLongPress={() => setStory(id)}
      />
    );
  }

  return (
    <AppCard textured style={styles.card}>
      <View style={styles.eyebrowRow}>
        <CardEyebrow>{i18n.t('honours')}</CardEyebrow>
        <Text style={styles.count} testID="honour-count">{heldIds.length} / {HONOUR_IDS.length}</Text>
      </View>
      <Text style={styles.hint}>{i18n.t('honours_hint')}</Text>
      <View style={styles.hall}>
        {ROWS.map((row, rowIndex) => {
          const isTriptych = row === THREAD_HONOUR_IDS;
          return (
            <View key={rowIndex} style={[styles.row, isTriptych && styles.triptych]} testID={isTriptych ? 'honour-triptych' : undefined}>
              {row.map((id, i) => {
                const slot = renderSlot(id);
                if (!isTriptych || i === 0) return slot;
                const lit = heldById.has(row[i - 1]) && heldById.has(id);
                return [
                  <View
                    key={`thread-${id}`}
                    testID={`honour-thread-${id}`}
                    accessibilityState={{ selected: lit }}
                    style={[styles.thread, lit && styles.threadLit]}
                  />,
                  slot,
                ];
              })}
            </View>
          );
        })}
      </View>
      {unopened.length > 0 && (
        <>
          <SectionDivider />
          <CardEyebrow>{i18n.t('milestones')}</CardEyebrow>
          {unopened.map((m) => (
            <TouchableOpacity key={m.id} disabled={isOpening} onPress={() => handleOpenMilestone(m.id!)} style={styles.milestoneRow}>
              <Icon name="treasure-chest-outline" size={ICON_SIZES.lg} color={COLORS.gold} />
              <Text style={styles.milestoneName}>{tKey(m.nameKey)}</Text>
              <Text style={styles.milestoneXp}>+{m.xp}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <SheetModal visible={story !== null} onClose={() => setStory(null)}>
        {story && (
          <View style={styles.story} testID="honour-story">
            <View style={[styles.storyChip, { borderColor: storyHeld ? metalFor(storyHeld) : INK.muted }]}>
              <Icon name={HONOUR_ICONS[story]} size={ICON_SIZES.huge} color={storyHeld ? metalFor(storyHeld) : INK.muted} />
            </View>
            <Text style={styles.storyName}>{itemLabel(story)}</Text>
            <Text style={styles.storyLore}>{tKey(HONOUR_LORE_KEYS[story])}</Text>
            {storyHeld ? (
              <Text style={styles.storyMeta}>{i18n.t('honour_earned')} · {formatDate(storyHeld.acquiredAt)}</Text>
            ) : (
              <Text style={styles.storyMeta}>{tKey(HONOUR_DEED_KEYS[story])}</Text>
            )}
            {storyHeld && (
              <GameButton
                variant={storyHeld.equipped ? 'ghost' : 'primary'}
                disabled={isEquipping}
                // Nothing native is presented after the sheet, so this needs no `closeThen`.
                onPress={() => { const id = story; setStory(null); equip(id); }}
              >
                {i18n.t(storyHeld.equipped ? 'honour_take_off' : 'honour_wear')}
              </GameButton>
            )}
            <GameButton variant="ghost" size="compact" onPress={() => setStory(null)}>{i18n.t('back')}</GameButton>
          </View>
        )}
      </SheetModal>

      <ChestModal
        visible={chestVisible}
        xp={chest?.xp ?? 0}
        onDismiss={() => {
          if (chest?.deferredTierUp) setPendingTierUp(chest.deferredTierUp);
          setChestVisible(false);
        }}
      />
      <AlertModal
        visible={failAlert}
        tone="warning"
        title={i18n.t('action_failed_title')}
        message={i18n.t('action_failed_body')}
        onDismiss={() => setFailAlert(false)}
      />
    </AppCard>
  );
}

function metalFor(held: HeldHonour): string {
  return METAL_COLORS[held.rarity ?? ''] ?? COLORS.gold;
}

interface SlotProps {
  id: HonourId;
  held: HeldHonour | undefined;
  /** True once this honour arrived while the hall was open; stays true so the slot never un-lights. */
  ignited: boolean;
  progress: HonourProgress | undefined;
  animate: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * One slot in the hall. `lit` is the single value the ignition drives — 0 is the dark slot, 1 is
 * the held one — so a slot that was held on arrival simply starts at 1, and one that ignites
 * fades its emblem from ink to metal while the metal ring sweeps in over it. Border colour is not
 * native-driver animatable, hence the ring is an overlay that fades rather than a border that
 * changes.
 */
function HonourSlot({ id, held, ignited, progress, animate, onPress, onLongPress }: SlotProps) {
  const metal = held ? metalFor(held) : INK.muted;
  const isEmber = !!held && held.rarity === 'Ember';
  const lit = useRef(new Animated.Value(held && !ignited ? 1 : 0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [burst, setBurst] = useState(0);
  // Gold shimmers once, on arrival or on ignition, and then rests.
  const [sweepArmed, setSweepArmed] = useState(!!held && !ignited);

  useEffect(() => {
    if (!ignited) return;
    setBurst((n) => n + 1);
    if (!animate) {
      lit.setValue(1);
      setSweepArmed(true);
      return;
    }
    const run = Animated.timing(lit, { toValue: 1, duration: IGNITE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start(({ finished }) => { if (finished) setSweepArmed(true); });
    return () => run.stop();
  }, [ignited, animate, lit]);

  // Ember breathes: the honours with stakes are the ones still burning.
  useEffect(() => {
    if (!held || !isEmber || !animate) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 0.75, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 1, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); breath.setValue(1); };
  }, [held, isEmber, animate, breath]);

  const shimmer = !!held && !isEmber && animate && sweepArmed;
  useEffect(() => {
    if (!shimmer) return;
    sweep.setValue(0);
    const run = Animated.sequence([
      Animated.delay(300),
      Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [shimmer, sweep]);

  const pct = progress ? Math.min(1, progress.held / progress.needed) : 0;
  const litOpacity = lit.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const dimOpacity = lit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const ringScale = lit.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });

  return (
    <TouchableOpacity
      testID={`honour-${id}`}
      // Not `disabled` for a dark slot: RN's Touchable reads `accessibilityState.disabled` as
      // `disabled`, which would swallow the long press that opens its story.
      accessibilityLabel={`${itemLabel(id)} · ${held ? formatDate(held.acquiredAt) : tKey(HONOUR_DEED_KEYS[id])}`}
      accessibilityState={{ selected: !!held?.equipped }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.8}
      style={[styles.slot, held?.equipped && styles.slotEquipped]}
    >
      <Animated.View style={[styles.slotBody, { opacity: held ? litOpacity : 0.55 }]}>
        {held && (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: metal, opacity: lit, transform: [{ scale: ringScale }] }]}
          />
        )}
        <View style={styles.slotIconChip} testID={`honour-emblem-${id}`}>
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.chipCentre, { opacity: held ? dimOpacity : 1 }]}>
            <Icon name={HONOUR_ICONS[id]} size={ICON_SIZES.lg} color={INK.muted} />
          </Animated.View>
          {held && (
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.chipCentre, { opacity: Animated.multiply(lit, breath) }]}>
              <Icon name={HONOUR_ICONS[id]} size={ICON_SIZES.lg} color={metal} />
            </Animated.View>
          )}
          {shimmer && (
            <Animated.View
              pointerEvents="none"
              style={[styles.sweep, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-CHIP, CHIP] }) }, { rotate: '20deg' }] }]}
            >
              <LinearGradient
                colors={['transparent', tint(COLORS.goldBright, 0.55), 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
        </View>
        <Text style={[styles.slotName, !held && styles.slotNameDark]} numberOfLines={2}>{itemLabel(id)}</Text>
        {held ? (
          held.equipped
            ? <Text style={styles.equippedTag}>{i18n.t('equipped')}</Text>
            : <Text style={styles.dateTag}>{formatDate(held.acquiredAt)}</Text>
        ) : (
          <>
            <Text style={styles.deedTag} numberOfLines={2}>{tKey(HONOUR_DEED_KEYS[id])}</Text>
            {progress && (
              <View style={styles.progress} testID={`honour-progress-${id}`}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>{i18n.t('honour_progress', { held: progress.held, needed: progress.needed })}</Text>
              </View>
            )}
          </>
        )}
      </Animated.View>
      {burst > 0 && <ChestBurst size={96} trigger={burst} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: COLORS.gold },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textDim, marginBottom: SPACE.md },
  hall: { gap: SPACE.md },
  row: { flexDirection: 'row', gap: SPACE.md, alignItems: 'stretch' },
  triptych: { gap: 0, alignItems: 'center' },
  thread: { width: SPACE.md, height: 2, backgroundColor: INK.muted, opacity: 0.5 },
  threadLit: { backgroundColor: COLORS.gold, opacity: 1 },
  slot: {
    flex: 1, minWidth: 92, borderWidth: 2, borderColor: INK.muted, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelDeep,
  },
  slotEquipped: { backgroundColor: COLORS.panelRaised },
  slotBody: { alignItems: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, gap: SPACE.xs },
  ring: { ...StyleSheet.absoluteFillObject, margin: -2, borderWidth: 2, borderRadius: RADIUS.md },
  slotIconChip: {
    ...circle(CHIP),
    backgroundColor: COLORS.panelRaised,
    overflow: 'hidden',
  },
  chipCentre: { alignItems: 'center', justifyContent: 'center' },
  sweep: { position: 'absolute', top: -CHIP / 2, left: 0, width: CHIP * 0.5, height: CHIP * 2 },
  slotName: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.xs, color: COLORS.text, textAlign: 'center' },
  slotNameDark: { color: COLORS.textDim },
  equippedTag: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: COLORS.gold, letterSpacing: 1 },
  dateTag: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textDim, textAlign: 'center' },
  deedTag: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xs, color: COLORS.textDim, textAlign: 'center' },
  progress: { alignSelf: 'stretch', alignItems: 'center', gap: SPACE.hair, marginTop: SPACE.hair },
  progressTrack: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: tint(COLORS.text, 0.1), overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.gold },
  progressText: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, color: COLORS.textDim },
  story: { alignItems: 'center', gap: SPACE.md },
  storyChip: { ...circle(72), borderWidth: 2, backgroundColor: COLORS.panelDeep, alignItems: 'center', justifyContent: 'center' },
  storyName: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.text, textAlign: 'center' },
  storyLore: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, lineHeight: LINE_HEIGHTS.md, color: COLORS.text, textAlign: 'center' },
  storyMeta: { fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, color: COLORS.textDim, textAlign: 'center' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  milestoneName: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.text },
  milestoneXp: { fontFamily: FONTS.display, fontSize: FONT_SIZES.md, color: COLORS.gold },
});
