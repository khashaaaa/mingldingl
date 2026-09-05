import { useRef, type ReactNode } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACE, overlay } from '../../lib/theme';

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
    <Modal
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
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {typeof children === 'function' ? children(closeThen) : children}
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
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
});
