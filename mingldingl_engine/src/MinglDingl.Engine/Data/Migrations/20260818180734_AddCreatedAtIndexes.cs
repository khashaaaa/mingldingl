using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCreatedAtIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Users_CreatedAt",
                table: "Users",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ScoreEvents_CreatedAt_EventType",
                table: "ScoreEvents",
                columns: new[] { "CreatedAt", "EventType" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_CreatedAt",
                table: "AdminAuditLogs",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_CreatedAt",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_ScoreEvents_CreatedAt_EventType",
                table: "ScoreEvents");

            migrationBuilder.DropIndex(
                name: "IX_AdminAuditLogs_CreatedAt",
                table: "AdminAuditLogs");
        }
    }
}
