using Microsoft.EntityFrameworkCore;
using Npgsql;

public static class UniqueViolationGuard
{
    public static bool IsViolation(DbUpdateException ex, string constraintName) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg &&
        pg.ConstraintName == constraintName;
}
