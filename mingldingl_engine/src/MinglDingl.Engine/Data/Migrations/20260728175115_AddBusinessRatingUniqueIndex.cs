using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessRatingUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BusinessRatings_BusinessPartnerId",
                table: "BusinessRatings");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessRatings_BusinessPartnerId_UserId_MatchId",
                table: "BusinessRatings",
                columns: new[] { "BusinessPartnerId", "UserId", "MatchId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BusinessRatings_BusinessPartnerId_UserId_MatchId",
                table: "BusinessRatings");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessRatings_BusinessPartnerId",
                table: "BusinessRatings",
                column: "BusinessPartnerId");
        }
    }
}
