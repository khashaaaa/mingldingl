import { Modal, Text, View, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, RADIUS, SPACE, overlay } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  visible: boolean;
  activityTitle: string | null;
  onYes: () => void;
  onNo: () => void;
  isSubmitting: boolean;
  onDismiss: () => void;
}

export function AttendanceCheckModal({ visible, activityTitle, onYes, onNo, isSubmitting, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Icon name="calendar-check" size={ICON_SIZES.xxl} color={COLORS.gold} />
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
    backgroundColor: overlay(0.88),
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xxxl,
    paddingVertical: SPACE.xxxl,
    alignItems: 'center',
    gap: SPACE.sm,
    maxWidth: 340,
    width: '100%',
  },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: COLORS.text, textAlign: 'center' },
  question: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim, textAlign: 'center', lineHeight: LINE_HEIGHTS.md },
  btnRow: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.md, alignSelf: 'stretch' },
});
