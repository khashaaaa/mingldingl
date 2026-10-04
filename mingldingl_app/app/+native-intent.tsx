import { routeIncomingLink } from '../lib/incomingLinks';

const SCHEME = 'mingldingl';

/** Every link from outside the app passes through here first; see `lib/incomingLinks.ts`. */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  return routeIncomingLink(path, initial, SCHEME);
}
