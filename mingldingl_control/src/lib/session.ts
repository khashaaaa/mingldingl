const listeners = new Set<(expired: boolean) => void>();
let expired = false;

export function isSessionExpired(): boolean {
  return expired;
}

function set(next: boolean): void {
  if (expired === next) return;
  expired = next;
  listeners.forEach((fn) => fn(expired));
}

export function markSessionExpired(): void {
  set(true);
}

export function clearSessionExpired(): void {
  set(false);
}

export function subscribeSession(fn: (expired: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
