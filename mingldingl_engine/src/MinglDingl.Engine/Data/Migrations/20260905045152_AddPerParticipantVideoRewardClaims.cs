using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPerParticipantVideoRewardClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "InitiatorVideoRewardClaimed",
                table: "Matches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReceiverVideoRewardClaimed",
                table: "Matches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // A match that already paid out did so under the old match-wide flag, and which side
            // collected was never recorded. Treating both as claimed is the only safe reading:
            // the alternative hands every historical match a second VideoCallDone and loot roll.
            migrationBuilder.Sql(
                """
                UPDATE "Matches"
                SET "InitiatorVideoRewardClaimed" = TRUE, "ReceiverVideoRewardClaimed" = TRUE
                WHERE "VideoRewardClaimed" = TRUE
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InitiatorVideoRewardClaimed",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "ReceiverVideoRewardClaimed",
                table: "Matches");
        }
    }
}
