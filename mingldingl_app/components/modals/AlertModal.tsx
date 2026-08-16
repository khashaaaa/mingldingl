import type { ReactNode } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export type AlertTone = 'default' | 'warning';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  onDismiss: () => void;
  tone?: AlertTone;
  // Optional confirm/cancel pair for destructive actions (e.g. unmatch) —
  // when omitted, renders as the original single-dismiss alert.
  confirmLabel?: string;
  onConfirm?: () => void;
  isConfirming?: boolean;
  // Optional custom content between the message and the button row — e.g.
  // a text input for "change phone number", so a form dialog doesn't need
  // its own bespoke Modal just to reuse this card's chrome.
  children?: ReactNode;
}

// In-theme stand-in for Alert.alert — the native OS dialog box breaks the
// dark-fantasy chrome (system font, default buttons) that every other
// surface in the app avoids. Styled after ChestModal's reward card so a
// "your photo failed to upload" message reads as the same world as
// "you found loot," not a different app underneath.
export function AlertModal({
  visible, title, message, onDismiss, tone = 'default',
  confirmLabel, onConfirm, isConfirming, children,
}: Props) {
  const tint = tone === 'warning' ? COLORS.ember : COLORS.gold;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor: tint }]}>
          <Text style={[styles.sigil, { color: tint }]}>{tone === 'warning' ? '⚠' : '❖'}</Text>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {children && <View style={styles.childrenWrap}>{children}</View>}
          {onConfirm ? (
            <View style={styles.btnRow}>
              <GameButton variant="ghost" onPress={onDismiss}>{i18n.t('alert_cancel')}</GameButton>
              <GameButton variant="danger" loading={isConfirming} onPress={onConfirm}>
                {confirmLabel ?? i18n.t('alert_dismiss')}
              </GameButton>
            </View>
          ) : (
            <GameButton variant="primary" style={styles.btnWrap} onPress={onDismiss}>{i18n.t('alert_dismiss')}</GameButton>
          )}
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
  message: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  childrenWrap: { alignSelf: 'stretch', marginTop: 4 },
  btnWrap: { marginTop: 10, alignSelf: 'stretch' },
  // Stacked, not a side-by-side row: a 50/50 split left long confirm labels
  // (e.g. "Abandon This Character") no room to breathe even after
  // GameButton's own shrink-to-fit, and truncated. Full-width buttons fix
  // that for every current and future confirm/cancel pair, not just this one.
  btnRow: { gap: 10, marginTop: 10, alignSelf: 'stretch' },
});
