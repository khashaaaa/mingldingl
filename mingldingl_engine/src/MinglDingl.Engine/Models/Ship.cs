public class Ship
{
    public Guid Id { get; set; }
    public Guid ShipperUserId { get; set; }
    public string Status { get; set; } = "Pending";

    public Guid? SlotAUserId { get; set; }
    public string? SlotAInviteCode { get; set; }
    public string SlotAOptIn { get; set; } = "AwaitingUser";

    public Guid? SlotBUserId { get; set; }
    public string? SlotBInviteCode { get; set; }
    public string SlotBOptIn { get; set; } = "AwaitingUser";

    public Guid? ResultMatchId { get; set; }

    public string? ShipperRewardItemId { get; set; }
    public DateTime? ShipperNotifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
