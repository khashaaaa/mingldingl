import type { AppStatusView, MeView } from './api/generated/model';
import type { SessionStatus } from './session';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;
export type ClosedWhy = 'suspended' | 'deleted' | 'update' | 'maintenance';

export type Belongs =
  | { group: 'loading' }
  | { group: 'out' }
  | { group: 'closed'; why: ClosedWhy }
  | { group: 'onboarding'; step: OnboardingStep }
  | { group: 'world' };

/**
 * The one place that decides where a person belongs. The root layout renders exactly one group
 * from this; screens never redirect. Onboarding progress comes from the server's profile, so a
 * relaunch resumes on the right step.
 */
export function whereBelongs(i: {
  session: SessionStatus;
  me?: MeView;
  app?: AppStatusView;
  appVersion: string;
}): Belongs {
  if (i.app?.maintenance) return { group: 'closed', why: 'maintenance' };
  if (i.app && semverLt(i.appVersion, i.app.minVersion)) return { group: 'closed', why: 'update' };
  if (i.session === 'unknown') return { group: 'loading' };
  if (i.session === 'none') return { group: 'out' };
  if (!i.me) return { group: 'loading' };
  if (i.me.status === 'Suspended') return { group: 'closed', why: 'suspended' };
  if (i.me.status === 'Deleted') return { group: 'closed', why: 'deleted' };
  if (i.me.onboardingStep < 7)
    return { group: 'onboarding', step: Math.max(1, i.me.onboardingStep) as OnboardingStep };
  return { group: 'world' };
}

export function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
