public class Ship
{
    public Guid Id { get; set; }
    public Guid ShipperUserId { get; set; }
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// The number the Weaver nominated, kept only while the slot is still waiting for that person
    /// to sign up. An invite code alone is a bearer token: whoever presented one was bound into the
    /// slot, so a guessed or forwarded code put a stranger into someone else's thread. Cleared the
    /// moment the slot resolves to a user, so a Ship holds a phone number no longer than it needs
    /// one — and <see cref="DailyMaintenanceBackgroundService"/> clears it on deletion too.
    /// </summary>
    public string? SlotAPhoneNumber { get; set; }
    public Guid? SlotAUserId { get; set; }
    public string? SlotAInviteCode { get; set; }
    public string SlotAOptIn { get; set; } = "AwaitingUser";

    public string? SlotBPhoneNumber { get; set; }
    public Guid? SlotBUserId { get; set; }
    public string? SlotBInviteCode { get; set; }
    public string SlotBOptIn { get; set; } = "AwaitingUser";

    public Guid? ResultMatchId { get; set; }

    public string? ShipperRewardItemId { get; set; }
    public DateTime? ShipperNotifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
