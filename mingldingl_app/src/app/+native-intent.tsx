import { redirectLink } from '@/lib/links';

/** Links into the app are rewritten before routing (an ally's call, a thread's invitation). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return redirectLink(path);
}
