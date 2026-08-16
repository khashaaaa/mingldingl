using Microsoft.EntityFrameworkCore;
using Npgsql;

// Shared detection for the ix_score_events_once_per_day partial unique index
// violation (see migration 20260705044949_AddScoreEventsOncePerDayIndex).
// DailyLogin and QuestChest both do a check-then-award (TOCTOU); the index is
// the real guard, and this lets both call sites turn "lost the race" into an
// idempotent already-claimed response instead of a 500.
public static class OncePerDayScoreEventGuard
{
    public static bool IsViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg &&
        pg.ConstraintName == "ix_score_events_once_per_day";
}
