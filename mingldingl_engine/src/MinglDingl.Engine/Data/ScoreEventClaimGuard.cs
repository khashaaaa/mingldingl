using Microsoft.EntityFrameworkCore;
using Npgsql;

/// <summary>
/// Recognises a losing claim on one of the partial unique indexes that make a ScoreEvent
/// award idempotent — once per UTC day, or once for the lifetime of the account.
/// </summary>
public static class ScoreEventClaimGuard
{
    public const string OncePerDayIndex = "ix_score_events_once_per_day";
    public const string OnceEverIndex = "ix_score_events_once_ever";

    public static bool IsViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg &&
        (pg.ConstraintName == OncePerDayIndex || pg.ConstraintName == OnceEverIndex);
}
