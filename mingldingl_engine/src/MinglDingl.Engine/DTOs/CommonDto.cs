public record ErrorResponse(string Error);

public record HealthResponse(string Status);

public record PublicStatsResponse(int ActiveDatersThisWeek, int NewBondsThisWeek, int DatesConfirmedThisWeek, DateTime AsOf);

// Deliberately just a boolean — the shipper's identity and the other slot's
// info must never leak to an anonymous public page (same privacy constraint
// ShipService.CreateAsync already applies to the in-app flow: neither slot
// ever learns whether the other resolved to an existing account).
public record PublicShipInviteResponse(bool Valid);
