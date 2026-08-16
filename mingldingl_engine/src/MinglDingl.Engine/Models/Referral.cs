public class Referral
{
    public Guid Id { get; set; }
    public Guid InviterUserId { get; set; }
    public Guid InviteeUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? InviterRewardItemId { get; set; }
    public string? InviteeRewardItemId { get; set; }
    // Set the moment GET /scores/me/detail has surfaced the inviter's
    // reward once — read-once, no separate acknowledge call.
    public DateTime? InviterNotifiedAt { get; set; }
}
