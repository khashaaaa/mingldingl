import { useRef, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SPACE } from '../../lib/theme';
import { DialogCard, DialogScrim } from './DialogSurface';
import { AppModal } from './AppModal';

/**
 * Runs `action` once the sheet has finished dismissing. On iOS a native picker cannot be
 * presented over a modal that is still closing, so the action is parked until `onDismiss`
 * fires; every other platform runs it straight away.
 */
export type CloseThen = (action: () => void) => void;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode | ((closeThen: CloseThen) => ReactNode);
}

/** The bronze-bordered action sheet shared by the photo-source and oath pickers. */
export function SheetModal({ visible, onClose, children }: Props) {
  const pendingRef = useRef<(() => void) | null>(null);

  const closeThen: CloseThen = (action) => {
    if (Platform.OS === 'ios') {
      pendingRef.current = action;
      onClose();
    } else {
      onClose();
      action();
    }
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        const action = pendingRef.current;
        pendingRef.current = null;
        action?.();
      }}
    >
      <DialogScrim weight="sheet">
        <DialogCard weight="sheet" style={styles.sheet}>
          {typeof children === 'function' ? children(closeThen) : children}
        </DialogCard>
      </DialogScrim>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  // Everything else a sheet is comes from `DialogCard weight="sheet"`; the only thing left that
  // is this sheet's own is that its rows stack with a gap rather than centring.
  sheet: { alignItems: 'stretch', gap: SPACE.md },
});
