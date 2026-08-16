// Support-lookup view of the Fated Threads matchmaking flow — a Ship stuck
// AwaitingUser/PendingOptIn for a long time, or one Declined/Expired, has
// nowhere to be seen from the admin dashboard otherwise.
public record AdminShipListItemDto(
    Guid Id,
    string Status,
    Guid ShipperUserId,
    string ShipperDisplayName,
    Guid? SlotAUserId,
    string? SlotADisplayName,
    string SlotAOptIn,
    Guid? SlotBUserId,
    string? SlotBDisplayName,
    string SlotBOptIn,
    Guid? ResultMatchId,
    DateTime CreatedAt);
