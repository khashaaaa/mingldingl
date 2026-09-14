using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class UniqueDateConfirmationsAndOpenReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rows the missing constraints already let through. A duplicate pledge row is folded into
            // the most advanced copy (both sides' pledges kept), and a duplicate open report is closed
            // as Dismissed rather than deleted, since reports are the moderation record.
            migrationBuilder.Sql("""
                UPDATE "DateConfirmations" d
                SET "InitiatorConfirmed" = agg.init, "ReceiverConfirmed" = agg.recv
                FROM (
                    SELECT "MatchId", "ActivitySuggestionId",
                           BOOL_OR("InitiatorConfirmed") AS init, BOOL_OR("ReceiverConfirmed") AS recv
                    FROM "DateConfirmations"
                    GROUP BY "MatchId", "ActivitySuggestionId"
                    HAVING COUNT(*) > 1
                ) agg
                WHERE d."MatchId" = agg."MatchId" AND d."ActivitySuggestionId" = agg."ActivitySuggestionId";

                DELETE FROM "DateConfirmations"
                WHERE "Id" IN (
                    SELECT "Id" FROM (
                        SELECT "Id", ROW_NUMBER() OVER (
                            PARTITION BY "MatchId", "ActivitySuggestionId"
                            ORDER BY ("CompletedAt" IS NULL), "PenaltyApplied" DESC, "CreatedAt", "Id") AS rn
                        FROM "DateConfirmations"
                    ) ranked
                    WHERE rn > 1
                );

                UPDATE "UserReports"
                SET "Status" = 'Dismissed',
                    "ReviewNotes" = 'Closed as a duplicate of an earlier open report by the same reporter',
                    "ReviewedBy" = 'migration',
                    "ReviewedAt" = now()
                WHERE "Id" IN (
                    SELECT "Id" FROM (
                        SELECT "Id", ROW_NUMBER() OVER (
                            PARTITION BY "ReporterId", "ReportedUserId" ORDER BY "CreatedAt", "Id") AS rn
                        FROM "UserReports"
                        WHERE "Status" = 'Pending'
                    ) ranked
                    WHERE rn > 1
                );
                """);

            migrationBuilder.DropIndex(
                name: "IX_UserReports_ReporterId_ReportedUserId_Status",
                table: "UserReports");

            migrationBuilder.CreateIndex(
                name: "IX_UserReports_ReporterId_ReportedUserId",
                table: "UserReports",
                columns: new[] { "ReporterId", "ReportedUserId" },
                unique: true,
                filter: "\"Status\" = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_DateConfirmations_MatchId_ActivitySuggestionId",
                table: "DateConfirmations",
                columns: new[] { "MatchId", "ActivitySuggestionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserReports_ReporterId_ReportedUserId",
                table: "UserReports");

            migrationBuilder.DropIndex(
                name: "IX_DateConfirmations_MatchId_ActivitySuggestionId",
                table: "DateConfirmations");

            migrationBuilder.CreateIndex(
                name: "IX_UserReports_ReporterId_ReportedUserId_Status",
                table: "UserReports",
                columns: new[] { "ReporterId", "ReportedUserId", "Status" });
        }
    }
}
