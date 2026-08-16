using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddScoreEventsOncePerDayIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Partial expression index: guards the check-then-award TOCTOU window on
            // DailyLogin and QuestChest (both once-per-UTC-day events). EF's fluent API
            // can't express a functional (date-cast) index, hence raw SQL. The loser of
            // a race now hits a unique-violation on INSERT instead of double-awarding;
            // the two call sites catch DbUpdateException and return the idempotent
            // "already claimed" response.
            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX ix_score_events_once_per_day
                ON ""ScoreEvents"" (""UserId"", ""EventType"", ((""CreatedAt"" AT TIME ZONE 'UTC')::date))
                WHERE ""EventType"" IN ('DailyLogin', 'QuestChest');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ix_score_events_once_per_day;");
        }
    }
}
