import { useAuthStore } from '../store/authStore';
import { useProfile } from './useProfile';

/**
 * The engine's id for the signed-in account — NOT the Supabase `sub`.
 *
 * Every sign-in mints a fresh anonymous Supabase identity, which the engine aliases onto the
 * account that has claimed a verification for that phone number (see CLAUDE.md). So for every
 * returning user the JWT `sub` differs from the `Users.Id` the engine stamps on messages,
 * icebreaker answers and nudge broadcasts. Anything asking "is this row mine?" must compare
 * against this, or a returning user's own messages read as the other person's.
 *
 * Falls back to the `sub` only until the profile resolves — for a brand-new account the two are
 * the same, because `POST /users` creates the row under the calling identity.
 */
export function useMyUserId(): string | undefined {
  const { data: profile } = useProfile();
  const sub = useAuthStore((s) => s.session?.user.id);
  return profile?.id ?? sub;
}
