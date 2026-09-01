/// <summary>
/// The body of every error response. <c>Error</c> is developer-facing English; <c>Code</c> is
/// the stable identifier clients map to their own localised copy — never show <c>Error</c> to
/// a user, it is not translated.
/// </summary>
public record ErrorResponse(string Error, string Code);

public record HealthResponse(string Status);

public record PublicStatsResponse(int ActiveDatersThisWeek, int NewBondsThisWeek, int DatesConfirmedThisWeek, DateTime AsOf);

public record PublicShipInviteResponse(bool Valid);
