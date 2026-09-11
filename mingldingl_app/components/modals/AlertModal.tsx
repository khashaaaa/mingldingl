import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { STATUS_SOFT, STATUS, LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';
import { DialogCard, DialogScrim } from './DialogSurface';
import { Icon } from '../ui/Icon';
import { AppModal } from './AppModal';

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
  // The warning tone draws the colour the palette reserves for it, not a metal. Its own note in
  // `theme.ts` requires a warning to be a filled banner with an icon, never bare text — which is
  // what this card is, so the fill comes with it.
  const isWarning = tone === 'warning';
  const tint = isWarning ? STATUS.warning : ACCENT.base;
  // #7: while a confirm is in flight, cancelling (or hardware back) would race the request.
  const locked = !!isConfirming;
  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!locked) onDismiss(); }}>
      <DialogScrim>
        <DialogCard accent={tint} style={isWarning ? styles.warningFill : undefined}>
          <Icon name={tone === 'warning' ? 'alert' : 'rhombus-outline'} size={ICON_SIZES.xl} color={tint} />
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
        </DialogCard>
      </DialogScrim>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  warningFill: { backgroundColor: STATUS_SOFT.warning },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.xl, color: INK.primary, textAlign: 'center' },
  message: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim, textAlign: 'center', lineHeight: LEADING.md },
  childrenWrap: { alignSelf: 'stretch', marginTop: SPACE.xs },
  btnWrap: { marginTop: SPACE.md, alignSelf: 'stretch' },
  btnRow: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.md, alignSelf: 'stretch' },
});
