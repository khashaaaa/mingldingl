import { Modal, type ModalProps } from 'react-native';

/**
 * Every `<Modal>` in this app mounts through here, never straight from `react-native`.
 *
 * On Android, RN's `Modal` renders into its own `Dialog`, which owns a window separate from the
 * host Activity's. By default that window is not edge-to-edge, so the system paints it with its
 * own light-themed navigation and status bars — a white bar flashing in under this very dark
 * app every time a `Modal` opens (the leave-the-square confirm, the activities sheet, the chest,
 * ...). Setting `statusBarTranslucent`/`navigationBarTranslucent` puts that Dialog's own window
 * into edge-to-edge mode instead (RN's `ReactModalHostView.updateProperties` calls
 * `dialogWindow.enableEdgeToEdge()` when `navigationBarTranslucent` is true), so the system bars
 * turn transparent and each Modal's own overlay — already painted from `COLORS`/`overlay()`
 * tokens, never a literal — shows through them rather than the OS default. iOS ignores both
 * props; there this is a plain pass-through.
 *
 * `expo-navigation-bar` cannot do this: every one of its calls (`NavigationBarModule.kt`) reads
 * `currentActivity.window`, i.e. the host Activity's own window, never a Modal's Dialog window,
 * so it has no way to reach the surface that is actually painted white. It was evaluated and
 * ruled out for that reason rather than added as a dependency here.
 *
 * Because the fix lives on each Modal's own window rather than as an imperative call against
 * shared/global navigation-bar state, there is nothing to restore on dismiss or unmount, and
 * nothing to get clobbered when two Modals are open at once (this app does stack them — e.g.
 * the global daily-login `AlertModal` mounted in `app/_layout.tsx` can be visible at the same
 * time as a screen-local Modal): each Dialog disposes its own window when it closes, and never
 * touches any other window's state, so one closing can never undo another that is still open.
 */
export function AppModal({
  statusBarTranslucent = true,
  navigationBarTranslucent = true,
  ...props
}: ModalProps) {
  return (
    <Modal
      statusBarTranslucent={statusBarTranslucent}
      navigationBarTranslucent={navigationBarTranslucent}
      {...props}
    />
  );
}
