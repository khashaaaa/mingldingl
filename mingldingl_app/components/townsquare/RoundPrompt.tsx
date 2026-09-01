import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS, SPACE } from '../../lib/theme';

interface Props {
  icebreakerText: string;
  roundNumber: number;
  secondsLeft: number;
  hasResponded: boolean;
  matchId: string | null;
  isResponding: boolean;
  onRespond: (response: 'Yes' | 'No') => void;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function RoundPrompt({ icebreakerText, roundNumber, secondsLeft, hasResponded, matchId, isResponding, onRespond }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.roundLabel}>{i18n.t('town_square_round_label', { round: roundNumber })}</Text>
        <Text style={styles.clock}>{formatClock(secondsLeft)}</Text>
      </View>
      <Text style={styles.question}>{icebreakerText}</Text>
      {hasResponded ? (
        matchId ? (
          <Text style={styles.matchText}>{i18n.t('town_square_its_a_match')}</Text>
        ) : (
          <Text style={styles.waitingText}>{i18n.t('town_square_waiting_for_round')}</Text>
        )
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.noButton, isResponding && styles.buttonBusy]}
            disabled={isResponding}
            accessibilityRole="button"
            accessibilityState={{ disabled: isResponding }}
            onPress={() => onRespond('No')}
          >
            <Text style={[styles.buttonText, styles.noButtonText]}>{i18n.t('town_square_no')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.yesButton, isResponding && styles.buttonBusy]}
            disabled={isResponding}
            accessibilityRole="button"
            accessibilityState={{ disabled: isResponding }}
            onPress={() => onRespond('Yes')}
          >
            <Text style={[styles.buttonText, styles.yesButtonText]}>{i18n.t('town_square_yes')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(18,20,28,0.92)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textDim, letterSpacing: 1 },
  clock: { fontFamily: FONTS.displayBlack, fontSize: 16, color: COLORS.goldBright },
  question: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.text },
  waitingText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim },
  matchText: { fontFamily: FONTS.displayBlack, fontSize: 18, color: COLORS.goldBright },
  buttonRow: { flexDirection: 'row', gap: SPACE.md },
  button: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  buttonBusy: { opacity: 0.5 },
  yesButton: { backgroundColor: COLORS.gold, borderColor: COLORS.goldBright },
  noButton: { backgroundColor: COLORS.panelRaised, borderColor: COLORS.bronze },
  buttonText: { fontFamily: FONTS.display, fontSize: 15, letterSpacing: 1 },
  // Light-on-gold reads at 2.4:1; the rest of the app puts a dark label on this slab (as GameButton does).
  yesButtonText: { color: COLORS.panelDeep },
  noButtonText: { color: COLORS.text },
});
