// Append-only purchase/renewal log — one row per Upgrade call (including a
// zero-value row when someone cancels back to Free). User.MembershipExpiresAt
// is the fast "is this person currently paid" check; this table is the
// historical record a future admin view can query. Existed since the initial
// migration but was never wired to anything until 2026-07-28.
public class Membership
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Level { get; set; } = "Free";
    public int DurationMonths { get; set; } // 0 for a Free/cancel event
    public int PriceMnt { get; set; } // 0 for a Free/cancel event
    public DateTime? ExpiresAt { get; set; } // null for a Free/cancel event
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
