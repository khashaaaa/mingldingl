// Pure lapse check for the daily maintenance sweep — mirrors
// GhostingService.IsStale: a static predicate filtered over an
// already-materialized list, not translated into SQL.
public static class MembershipExpiry
{
    public static bool HasExpired(User user, DateTime now) =>
        user.MembershipLevel != "Free"
        && user.MembershipExpiresAt.HasValue
        && user.MembershipExpiresAt.Value < now;
}
