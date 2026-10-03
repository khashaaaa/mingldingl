using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPushTokenUserAndSuggestionMatchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_PushTokens_UserId",
                table: "PushTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivitySuggestions_MatchId",
                table: "ActivitySuggestions",
                column: "MatchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PushTokens_UserId",
                table: "PushTokens");

            migrationBuilder.DropIndex(
                name: "IX_ActivitySuggestions_MatchId",
                table: "ActivitySuggestions");
        }
    }
}
