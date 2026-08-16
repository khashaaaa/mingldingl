using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscoverLeaderboardIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Users_City_TotalScore",
                table: "Users",
                columns: new[] { "City", "TotalScore" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Gender_IsPaused_DeletionRequestedAt",
                table: "Users",
                columns: new[] { "Gender", "IsPaused", "DeletionRequestedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_City_TotalScore",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_Gender_IsPaused_DeletionRequestedAt",
                table: "Users");
        }
    }
}
