import * as Sentry from '@sentry/react-native';

const PHONE = /(?<!\d)\d{8}(?!\d)/g;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

/** Nothing personal leaves the device: no phone numbers, tokens, request bodies or user. */
export function scrubText(s: string | undefined): string | undefined {
  return s?.replace(JWT, '[token]').replace(PHONE, '[phone]');
}

export function scrubEvent<E extends Sentry.ErrorEvent>(e: E): E {
  e.user = undefined;
  if (e.request) {
    e.request.data = undefined;
    e.request.query_string = undefined;
    e.request.cookies = undefined;
    if (e.request.headers) delete e.request.headers.Authorization;
  }
  if (e.message) e.message = scrubText(e.message);
  for (const ex of e.exception?.values ?? []) ex.value = scrubText(ex.value);
  for (const b of e.breadcrumbs ?? []) b.message = scrubText(b.message);
  return e;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Off unless EXPO_PUBLIC_SENTRY_DSN is set. */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    beforeSend: (e) => scrubEvent(e),
    beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
  });
}
