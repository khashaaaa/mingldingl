import { isAxiosError } from 'axios';

/**
 * Reads the engine's `{ error: string }` envelope, which every endpoint emits — the middleware,
 * the ApiErrorExtensions helpers, and model-state validation all share that shape. Falling back
 * to a generic string discards a message the server wrote specifically for this failure.
 */
export function serverError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}

/** Wrong password, lockout (429) and "not configured" each carry their own message; no response at all is the network. */
export function loginError(err: unknown): string {
  if (isAxiosError(err) && !err.response) return "Couldn't reach the engine — check the connection and try again.";
  return serverError(err, 'Sign-in failed — try again.');
}
