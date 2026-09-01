import type { ReactNode } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { Icon } from '../ui/Icon';

export type AlertTone = 'default' | 'warning';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  onDismiss: () => void;
  tone?: AlertTone;

  confirmLabel?: string;
  onConfirm?: () => void;
  isConfirming?: boolean;
  /** Destructive confirms get the danger slab; everything else uses the primary one. */
  destructive?: boolean;

  children?: ReactNode;
}

export function AlertModal({
  visible, title, message, onDismiss, tone = 'default',
  confirmLabel, onConfirm, isConfirming, destructive = tone === 'warning', children,
}: Props) {
  const tint = tone === 'warning' ? COLORS.ember : COLORS.gold;
  // #7: while a confirm is in flight, cancelling (or hardware back) would race the request.
  const locked = !!isConfirming;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!locked) onDismiss(); }}>
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor: tint }]}>
          <Icon name={tone === 'warning' ? 'alert' : 'rhombus-outline'} size={22} color={tint} />
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {children && <View style={styles.childrenWrap}>{children}</View>}
          {onConfirm ? (
            <View style={styles.btnRow}>
              <GameButton variant="ghost" flex={1} disabled={locked} onPress={onDismiss}>
                {i18n.t('alert_cancel')}
              </GameButton>
              <GameButton
                variant={destructive ? 'danger' : 'primary'}
                flex={1}
                loading={isConfirming}
                onPress={onConfirm}
              >
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
  title: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.text, textAlign: 'center' },
  message: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  childrenWrap: { alignSelf: 'stretch', marginTop: 4 },
  btnWrap: { marginTop: 10, alignSelf: 'stretch' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
});
