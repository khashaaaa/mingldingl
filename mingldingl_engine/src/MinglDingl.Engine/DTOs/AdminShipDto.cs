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
