public class Ship
{
    public Guid Id { get; set; }
    public Guid ShipperUserId { get; set; }
    public string Status { get; set; } = "Pending"; // Pending|Sparked|Declined|Expired

    public Guid? SlotAUserId { get; set; }
    public string? SlotAInviteCode { get; set; }
    public string SlotAOptIn { get; set; } = "AwaitingUser"; // AwaitingUser|PendingOptIn|Accepted|Declined

    public Guid? SlotBUserId { get; set; }
    public string? SlotBInviteCode { get; set; }
    public string SlotBOptIn { get; set; } = "AwaitingUser";

    public Guid? ResultMatchId { get; set; }

    // Mirrors Referral's InviterRewardItemId/InviterNotifiedAt — set at
    // spark time, read once by GET /scores/me/detail, then never read again.
    public string? ShipperRewardItemId { get; set; }
    public DateTime? ShipperNotifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
