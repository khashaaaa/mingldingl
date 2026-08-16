import { Alert } from 'react-native';
import { i18n } from './i18n';

type ErrorHandler = (error: unknown, isFatal: boolean) => void;
interface ErrorUtilsGlobal {
  setGlobalHandler(handler: ErrorHandler): void;
  getGlobalHandler(): ErrorHandler;
}

let installed = false;

// Closes the gap ErrorBoundary can't cover: React error boundaries only catch
// errors thrown during rendering. An exception thrown inside an onPress
// handler, a setTimeout callback, or an unawaited async function/.then()
// chain currently escapes silently — the user taps something, nothing
// happens, no feedback, no log. This installs two global nets: React
// Native's own uncaught-JS-exception hook (every native-invoked JS callback,
// including onPress, is dispatched through ErrorUtils), and the standard
// `unhandledrejection` event for promises nobody awaited or .catch()'d.
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const errorUtils = (global as { ErrorUtils?: ErrorUtilsGlobal }).ErrorUtils;
  if (errorUtils) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Uncaught error:', error, { isFatal });
      notifyUser();
      previousHandler?.(error, isFatal);
    });
  }

  const globalTarget = global as {
    addEventListener?: (type: string, listener: (event: { reason?: unknown }) => void) => void;
  };
  globalTarget.addEventListener?.('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event?.reason);
    notifyUser();
  });
}

function notifyUser(): void {
  Alert.alert(i18n.t('error_boundary_title'), i18n.t('error_boundary_message'));
}
