import { useState } from 'react';
import {
  Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ORNAMENTS, FRET_ASPECT } from '../../lib/ornaments';
import { ROOMS, PASSAGES, type RoomName } from '../../lib/world';
import { useWorldState } from '../../hooks/useWorldState';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  ICON_SIZES,
  LINE,
  LINE_HEIGHTS,
  RADIUS,
  SPACE,
  circle,
  glow,
  overlay,
  tint,
} from '../../lib/theme';

const COLS = 3;
const ROWS = 5;
const MEDALLION = 46;
const FRET_HEIGHT = 14;

/** Above this the room reads as lit rather than merely known. */
const LIT = 0.5;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * A view of the hold, never a hallway through it. Every room on this map is reachable without it,
 * and it is a `Modal` rather than a route so dismissing always returns you exactly where you were
 * and it never enters the back stack. If a feature is ever reachable *only* from a medallion here,
 * that is the bug — not a new capability.
 */
export function AtlasOverlay({ visible, onClose }: Props) {
  useLocaleStore((s) => s.locale);
  const router = useRouter();
  const state = useWorldState();
  const [grid, setGrid] = useState({ w: 0, h: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setGrid({ w: width, h: height });
  }

  function centre(room: RoomName) {
    const { x, y } = ROOMS[room].atlas;
    return {
      cx: (grid.w / COLS) * (x + 0.5),
      cy: (grid.h / ROWS) * (y + 0.5),
    };
  }

  function go(room: RoomName) {
    onClose();
    router.navigate(ROOMS[room].route);
  }

  const delves = state.activeMatches ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={i18n.t('hold_close')}>
        {/* Swallow presses on the panel itself so only the scrim dismisses. */}
        <Pressable style={styles.panel} onPress={() => {}} accessibilityViewIsModal>
          <Text style={styles.title}>{i18n.t('hold_title')}</Text>
          <Image source={ORNAMENTS.fretGold} style={styles.fret} resizeMode="cover" />

          <View style={styles.grid} onLayout={onLayout} testID="atlas-grid">
            {grid.w > 0 && PASSAGES.map(([a, b]) => {
              const from = centre(a);
              const to = centre(b);
              const dx = to.cx - from.cx;
              const dy = to.cy - from.cy;
              const len = Math.hypot(dx, dy);
              return (
                <View
                  key={`${a}-${b}`}
                  pointerEvents="none"
                  style={[styles.passage, {
                    left: from.cx,
                    top: from.cy,
                    width: len,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  }]}
                />
              );
            })}

            {grid.w > 0 && (Object.keys(ROOMS) as RoomName[]).map((name) => {
              const { cx, cy } = centre(name);
              const t = ROOMS[name].light(state);
              // The Deep is not one room but N delves, so it lights from having any at all.
              const lit = name === 'deep' ? delves > 0 : t != null && t >= LIT;
              const known = name === 'deep' ? delves > 0 : t != null;
              const source = name === 'deep' && lit ? ORNAMENTS.knotEmber
                : lit ? ORNAMENTS.knotGold
                : ORNAMENTS.knotDim;
              return (
                <Pressable
                  key={name}
                  testID={`atlas-room-${name}`}
                  onPress={() => go(name)}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t(ROOMS[name].key)}
                  style={[styles.room, { left: cx - MEDALLION, top: cy - MEDALLION / 2 }]}
                >
                  <View style={[styles.medallion, lit && glow(COLORS.gold, 0.5, 8, 4)]}>
                    <Image source={source} style={styles.knot} resizeMode="contain" />
                    {name === 'deep' && delves > 0 && (
                      <Text style={styles.count}>{delves}</Text>
                    )}
                  </View>
                  <Text style={[styles.label, !known && styles.labelDim]} numberOfLines={2}>
                    {i18n.t(ROOMS[name].key)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: overlay(0.86), alignItems: 'center', justifyContent: 'center', padding: SPACE.gutter },
  panel: {
    width: '100%', maxWidth: 380,
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: LINE.edge, borderRadius: RADIUS.lg,
    paddingVertical: SPACE.xl, paddingHorizontal: SPACE.lg,
    gap: SPACE.sm,
  },
  title: {
    fontFamily: FONTS.display, fontSize: FONT_SIZES.title, lineHeight: LINE_HEIGHTS.title,
    color: COLORS.text, textAlign: 'center',
  },
  fret: { width: FRET_HEIGHT * FRET_ASPECT, height: FRET_HEIGHT, alignSelf: 'center', opacity: 0.8 },
  grid: { height: 400, marginTop: SPACE.sm },
  passage: {
    position: 'absolute', height: 1,
    backgroundColor: tint(LINE.edge, 0.7),
    transformOrigin: 'left center',
  },
  // Twice the medallion so a two-line Mongolian label has somewhere to go without clipping.
  room: { position: 'absolute', width: MEDALLION * 2, alignItems: 'center' },
  medallion: {
    ...circle(MEDALLION),
    backgroundColor: COLORS.panelDeep,
    borderWidth: 1, borderColor: LINE.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  knot: { width: ICON_SIZES.huge, height: ICON_SIZES.huge },
  count: {
    position: 'absolute',
    fontFamily: FONTS.display, fontSize: FONT_SIZES.sm, color: COLORS.goldBright,
  },
  label: {
    marginTop: SPACE.xs,
    fontFamily: FONTS.utility, fontSize: FONT_SIZES.xs, lineHeight: LINE_HEIGHTS.xs,
    color: COLORS.text, textAlign: 'center', width: '100%',
  },
  labelDim: { color: COLORS.textDim },
});
