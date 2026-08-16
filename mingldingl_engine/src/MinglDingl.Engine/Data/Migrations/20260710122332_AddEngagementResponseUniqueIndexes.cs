using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEngagementResponseUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_QuizResponses_QuizId_UserId_MatchId",
                table: "QuizResponses",
                columns: new[] { "QuizId", "UserId", "MatchId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IcebreakerResponses_MatchId_IcebreakerId_UserId",
                table: "IcebreakerResponses",
                columns: new[] { "MatchId", "IcebreakerId", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuizResponses_QuizId_UserId_MatchId",
                table: "QuizResponses");

            migrationBuilder.DropIndex(
                name: "IX_IcebreakerResponses_MatchId_IcebreakerId_UserId",
                table: "IcebreakerResponses");
        }
    }
}
