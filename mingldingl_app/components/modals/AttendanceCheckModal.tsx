import { Text, View, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';
import { DialogCard, DialogScrim } from './DialogSurface';
import { Icon } from '../ui/Icon';
import { AppModal } from './AppModal';

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
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <DialogScrim>
        <DialogCard>
          <Icon name="calendar-check" size={ICON_SIZES.xxl} color={ACCENT.base} />
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
        </DialogCard>
      </DialogScrim>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: INK.primary, textAlign: 'center' },
  question: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim, textAlign: 'center', lineHeight: LEADING.md },
  btnRow: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.md, alignSelf: 'stretch' },
});
