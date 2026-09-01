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

const NOTICE_COOLDOWN_MS = 10_000;
let lastNoticeAt = 0;

function notifyUser(): void {
  // A render loop or a burst of rejections fires this repeatedly; without a cooldown each one
  // stacks another modal on top of the last.
  const now = Date.now();
  if (now - lastNoticeAt < NOTICE_COOLDOWN_MS) return;
  lastNoticeAt = now;

  Alert.alert(i18n.t('error_boundary_title'), i18n.t('error_boundary_message'));
}
