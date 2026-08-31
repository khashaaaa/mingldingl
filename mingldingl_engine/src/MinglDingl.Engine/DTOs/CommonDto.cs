public record ErrorResponse(string Error);

public record HealthResponse(string Status);

public record PublicStatsResponse(int ActiveDatersThisWeek, int NewBondsThisWeek, int DatesConfirmedThisWeek, DateTime AsOf);

public record PublicShipInviteResponse(bool Valid);
