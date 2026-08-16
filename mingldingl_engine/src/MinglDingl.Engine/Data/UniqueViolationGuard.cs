using Microsoft.EntityFrameworkCore;
using Npgsql;

// Generic counterpart to OncePerDayScoreEventGuard for the engagement-response
// unique indexes (IcebreakerResponses, QuizResponses) — same TOCTOU shape as
// RequestMatch/SendMessage: check-then-insert with no DB guard, found via
// stress test. The index is the real guard; call sites use this to turn a
// lost race into a normal "someone else already responded" outcome instead
// of a 500.
public static class UniqueViolationGuard
{
    public static bool IsViolation(DbUpdateException ex, string constraintName) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg &&
        pg.ConstraintName == constraintName;
}
