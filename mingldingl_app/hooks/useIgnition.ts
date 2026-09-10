import { useEffect, useRef, useState } from 'react';

/**
 * Watches the list of held honours and reports the ones that *arrived* while this screen was
 * watching.
 *
 * Same distinction as `useUnsealing`: walking into a hall with three lit honours is not an
 * event, watching a fourth catch fire in front of you is. So the first list this hook sees is
 * recorded silently, and only ids missing from that snapshot count as ignitions. Pass `undefined`
 * while the inventory is still loading — an empty list read as "nothing held" would ignite every
 * honour the moment the real list landed.
 *
 * Ignited ids stay ignited for the life of the hook: the slot's lit animation is keyed on the
 * transition, and a re-render must not un-light it.
 */
export function useIgnition(heldIds: readonly string[] | undefined): string[] {
  const [ignited, setIgnited] = useState<string[]>([]);
  const seen = useRef<Set<string> | null>(null);
  // The array is rebuilt every render by the caller; the effect answers to its contents.
  const key = heldIds?.join('|');

  useEffect(() => {
    if (!heldIds) return;
    const previous = seen.current;
    seen.current = new Set(heldIds);
    if (!previous) return;
    const fresh = heldIds.filter((id) => !previous.has(id));
    if (fresh.length === 0) return;
    setIgnited((current) => [...current, ...fresh.filter((id) => !current.includes(id))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ignited;
}
