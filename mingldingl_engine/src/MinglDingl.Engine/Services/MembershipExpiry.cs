public static class MembershipExpiry
{
    public static bool HasExpired(User user, DateTime now) =>
        user.MembershipLevel != "Free"
        && user.MembershipExpiresAt.HasValue
        && user.MembershipExpiresAt.Value < now;
}
