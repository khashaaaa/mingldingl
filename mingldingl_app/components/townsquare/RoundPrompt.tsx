import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VIDEO_CONTROLS_BOTTOM, VIDEO_CONTROLS_SIZE } from '../video/VideoControls';
import { GameButton } from '../ui/GameButton';
import { ParchmentFill } from '../ui/ParchmentFill';
import { CardEyebrow } from '../ui/CardEyebrow';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, INK, METAL, SPACE, tint } from '../../lib/theme';

interface Props {
  icebreakerText: string;
  hasResponded: boolean;
  matchId: string | null;
  isResponding: boolean;
  onRespond: (response: 'Yes' | 'No') => void;
}

/**
 * The question at the bell, as parchment rising off the video call rather than a floating card —
 * the round number and its countdown moved up to the screen's own `HeaderBar` (Move 8's bell
 * title and glyph), so this strip is the question and the deed alone. `ParchmentFill` and the
 * square top-only corner follow `DialogStrip`'s own shape (`components/modals/DialogSurface.tsx`);
 * it stays a plain `View` rather than that component because a strip that never dismisses and
 * never dims the room behind it is not a dialog layer at all.
 */
export function RoundPrompt({ icebreakerText, hasResponded, matchId, isResponding, onRespond }: Props) {
  // The call controls are laid out from the safe-area bottom; a fixed 100 here put this card
  // underneath them on any device with a navigation bar, so Yes/No sat behind the hang-up button.
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + VIDEO_CONTROLS_BOTTOM + VIDEO_CONTROLS_SIZE + SPACE.lg;
  return (
    <View style={[styles.wrap, { bottom }]}>
      <ParchmentFill />
      <CardEyebrow>{i18n.t('bell_question')}</CardEyebrow>
      <Text style={styles.question}>{icebreakerText}</Text>
      {hasResponded ? (
        matchId ? (
          // Deliberately not a link: tapping it mid-round would end the call and forfeit every
          // remaining round. It used to stop at "It's a Match!" and say nothing more, so the match
          // simply vanished — the second line says where it went, and the closing screen lists it
          // with a way in.
          <View style={styles.matchBlock}>
            <Text style={styles.matchText}>{i18n.t('town_square_its_a_match')}</Text>
            <Text style={styles.waitingText}>{i18n.t('town_square_match_after')}</Text>
          </View>
        ) : (
          // `bell_waiting` would have read word-for-word the same as this key's new English, so
          // the plan's own rule applies: reuse the key rather than add a duplicate sentence.
          <Text style={styles.waitingText}>{i18n.t('town_square_waiting_for_round')}</Text>
        )
      ) : (
        <>
          <Text style={styles.helper}>{i18n.t('bell_decide')}</Text>
          <View style={styles.buttonRow}>
            <GameButton variant="ink" flex={1} disabled={isResponding} onPress={() => onRespond('No')}>
              {i18n.t('town_square_no')}
            </GameButton>
            <GameButton flex={1} disabled={isResponding} onPress={() => onRespond('Yes')}>
              {i18n.t('town_square_yes')}
            </GameButton>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  matchBlock: { gap: SPACE.xs, alignItems: 'center' },
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    // The board's "nothing rounded": a two-point ember rule stands in for the card border and
    // corner radius this strip used to carry.
    borderRadius: 0,
    borderTopWidth: 2,
    borderTopColor: tint(METAL.ember, 0.8),
    overflow: 'hidden',
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  question: { fontFamily: FONTS.body, fontSize: FONT_SIZES.xl, color: INK.primary },
  helper: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim },
  waitingText: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  matchText: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: ACCENT.bright },
  buttonRow: { flexDirection: 'row', gap: SPACE.md },
});
