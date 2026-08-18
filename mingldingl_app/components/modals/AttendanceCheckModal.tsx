import { Modal, Text, View, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

interface Props {
  visible: boolean;
  activityTitle: string | null;
  onYes: () => void;
  onNo: () => void;
  isSubmitting: boolean;
  onDismiss: () => void;
}

// A neutral Yes/No prompt, deliberately not built on AlertModal — that
// component's confirm/cancel pair is styled as "danger action vs cancel"
// (see AlertModal's own comments), which misrepresents "No, we didn't meet"
// as a destructive choice rather than a plain, equally-valid answer. No
// free-text field anywhere — nothing for either side to write about the
// other, per the No-Show Tracking spec's anti-abuse design.
export function AttendanceCheckModal({ visible, activityTitle, onYes, onNo, isSubmitting, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.sigil}>📍</Text>
          <Text style={styles.title}>{i18n.t('attendance_check_title')}</Text>
          <Text style={styles.question}>
            {i18n.t('attendance_check_question', { activity: activityTitle ?? '' })}
          </Text>
          <View style={styles.btnRow}>
            <GameButton variant="ghost" disabled={isSubmitting} onPress={onNo}>
              {i18n.t('attendance_check_no')}
            </GameButton>
            <GameButton variant="primary" loading={isSubmitting} onPress={onYes}>
              {i18n.t('attendance_check_yes')}
            </GameButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,16,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: 28,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 8,
    maxWidth: 340,
    width: '100%',
  },
  sigil: { fontSize: 26, marginBottom: 2 },
  title: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.text, textAlign: 'center' },
  question: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
});
