using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFlameRite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FlameRiteAcceptedAt",
                table: "Matches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FlameRiteCompletedAt",
                table: "Matches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FlameRiteProposedAt",
                table: "Matches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FlameRiteProposedById",
                table: "Matches",
                type: "uuid",
                nullable: true);

            // Anyone who already completed an encounter, or already claimed a
            // video reward, earned the right to pledge under the pre-rite rules.
            // Without this they would open the app to a locked pledge and a rite
            // they never agreed to. NOW() rather than the real completion time:
            // the column is only ever tested for null, and inventing a precise
            // historical timestamp we don't have would be worse than an honest
            // "already satisfied at migration time."
            migrationBuilder.Sql(@"
                UPDATE ""Matches"" m
                SET ""FlameRiteCompletedAt"" = NOW()
                WHERE m.""VideoRewardClaimed"" = TRUE
                   OR EXISTS (
                        SELECT 1 FROM ""DateConfirmations"" dc
                        WHERE dc.""MatchId"" = m.""Id"" AND dc.""CompletedAt"" IS NOT NULL);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FlameRiteAcceptedAt",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "FlameRiteCompletedAt",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "FlameRiteProposedAt",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "FlameRiteProposedById",
                table: "Matches");
        }
    }
}
