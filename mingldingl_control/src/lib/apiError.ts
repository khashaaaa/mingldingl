/**
 * Reads the engine's `{ error: string }` envelope, which every endpoint emits — the middleware,
 * the ApiErrorExtensions helpers, and model-state validation all share that shape. Falling back
 * to a generic string discards a message the server wrote specifically for this failure.
 */
export function serverError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}
