using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileCompleteOnceEverIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ProfileComplete is worth 100 — a sixth of the way to Sapphire — and was paid on every
            // false -> true transition of a flag the user can toggle at will by clearing a required
            // field and refilling it. Refund the farmed duplicates before the index makes them
            // impossible, or the CREATE INDEX below fails on the rows already in the table.
            migrationBuilder.Sql(@"
                CREATE TEMP TABLE score_event_refunds ON COMMIT DROP AS
                WITH duplicates AS (
                    SELECT ""Id"", ""UserId"", ""Delta"",
                           ROW_NUMBER() OVER (PARTITION BY ""UserId"" ORDER BY ""CreatedAt"", ""Id"") AS rn
                    FROM ""ScoreEvents""
                    WHERE ""EventType"" = 'ProfileComplete'
                ),
                removed AS (
                    DELETE FROM ""ScoreEvents"" e
                    USING duplicates d
                    WHERE e.""Id"" = d.""Id"" AND d.rn > 1
                    RETURNING d.""UserId"" AS user_id, d.""Delta"" AS delta
                )
                SELECT user_id, SUM(delta) AS overpaid FROM removed GROUP BY user_id;

                UPDATE ""Users"" u
                SET ""TotalScore"" = GREATEST(0, u.""TotalScore"" - r.overpaid)
                FROM score_event_refunds r
                WHERE u.""Id"" = r.user_id;

                -- Keep the gem tier consistent with the corrected score. Mirrors
                -- ScoreService.RecomputeAllGemTiersAsync, including its read of the one
                -- admin-tunable threshold, so a refunded user is not left wearing a tier
                -- their score no longer earns.
                UPDATE ""Users"" u
                SET ""GemTier"" = CASE
                    WHEN u.""TotalScore"" >= 2000 THEN 'Emerald'
                    WHEN u.""TotalScore"" >= 1000 THEN 'Ruby'
                    WHEN u.""TotalScore"" >= COALESCE((
                        SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs""
                        WHERE ""Key"" = 'tier.sapphire.threshold'), 600) THEN 'Sapphire'
                    WHEN u.""TotalScore"" >= 300 THEN 'Amethyst'
                    WHEN u.""TotalScore"" >= 100 THEN 'Opal'
                    ELSE 'Garnet'
                END
                FROM score_event_refunds r
                WHERE u.""Id"" = r.user_id;
            ");

            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX ix_score_events_once_ever
                ON ""ScoreEvents"" (""UserId"", ""EventType"")
                WHERE ""EventType"" IN ('ProfileComplete');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ix_score_events_once_ever;");
        }
    }
}
