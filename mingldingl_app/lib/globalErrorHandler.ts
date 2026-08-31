import { Alert } from 'react-native';
import { i18n } from './i18n';

type ErrorHandler = (error: unknown, isFatal: boolean) => void;
interface ErrorUtilsGlobal {
  setGlobalHandler(handler: ErrorHandler): void;
  getGlobalHandler(): ErrorHandler;
}

let installed = false;

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
