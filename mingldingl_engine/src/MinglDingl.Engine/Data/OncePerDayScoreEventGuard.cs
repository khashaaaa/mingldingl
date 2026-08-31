using Microsoft.EntityFrameworkCore;
using Npgsql;

public static class OncePerDayScoreEventGuard
{
    public static bool IsViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg &&
        pg.ConstraintName == "ix_score_events_once_per_day";
}
