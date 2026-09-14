using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOathProvenOnceEverIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // OathProven was guarded by a read-then-award, so two refreshes at once could both pay it.
            // Refund any duplicates before the index makes them impossible, or CREATE INDEX fails.
            migrationBuilder.Sql(@"
                CREATE TEMP TABLE oath_proven_refunds ON COMMIT DROP AS
                WITH duplicates AS (
                    SELECT ""Id"", ""UserId"", ""Delta"",
                           ROW_NUMBER() OVER (PARTITION BY ""UserId"" ORDER BY ""CreatedAt"", ""Id"") AS rn
                    FROM ""ScoreEvents""
                    WHERE ""EventType"" = 'OathProven'
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
                FROM oath_proven_refunds r
                WHERE u.""Id"" = r.user_id;

                -- Mirrors ScoreService's tier ladder with each admin-tunable threshold read from config.
                UPDATE ""Users"" u
                SET ""GemTier"" = CASE
                    WHEN u.""TotalScore"" >= COALESCE((SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs"" WHERE ""Key"" = 'tier.emerald.threshold'), 2000) THEN 'Emerald'
                    WHEN u.""TotalScore"" >= COALESCE((SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs"" WHERE ""Key"" = 'tier.ruby.threshold'), 1000) THEN 'Ruby'
                    WHEN u.""TotalScore"" >= COALESCE((SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs"" WHERE ""Key"" = 'tier.sapphire.threshold'), 600) THEN 'Sapphire'
                    WHEN u.""TotalScore"" >= COALESCE((SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs"" WHERE ""Key"" = 'tier.amethyst.threshold'), 300) THEN 'Amethyst'
                    WHEN u.""TotalScore"" >= COALESCE((SELECT NULLIF(""Value"", '')::numeric FROM ""AdminConfigs"" WHERE ""Key"" = 'tier.opal.threshold'), 100) THEN 'Opal'
                    ELSE 'Garnet'
                END
                FROM oath_proven_refunds r
                WHERE u.""Id"" = r.user_id;
            ");

            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ix_score_events_once_ever;
                CREATE UNIQUE INDEX ix_score_events_once_ever
                ON ""ScoreEvents"" (""UserId"", ""EventType"")
                WHERE ""EventType"" IN ('ProfileComplete', 'OathProven');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ix_score_events_once_ever;
                CREATE UNIQUE INDEX ix_score_events_once_ever
                ON ""ScoreEvents"" (""UserId"", ""EventType"")
                WHERE ""EventType"" IN ('ProfileComplete');
            ");
        }
    }
}
