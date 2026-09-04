using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropUnusedTownSquareResponsesAndConfigSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Both targets are provably empty: no code path has ever written to either. The
            // responses table was scaffolded with the Town Square feature but the round
            // icebreaker is a conversation prompt shown during the call, never answered in
            // the app, and SchemaJson was never populated or read by the config admin.
            migrationBuilder.DropTable(
                name: "TownSquareIcebreakerResponses");

            migrationBuilder.DropColumn(
                name: "SchemaJson",
                table: "AdminConfigs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SchemaJson",
                table: "AdminConfigs",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TownSquareIcebreakerResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PairingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Answer = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TownSquareIcebreakerResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TownSquareIcebreakerResponses_TownSquarePairings_PairingId",
                        column: x => x.PairingId,
                        principalTable: "TownSquarePairings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TownSquareIcebreakerResponses_PairingId_UserId",
                table: "TownSquareIcebreakerResponses",
                columns: new[] { "PairingId", "UserId" },
                unique: true);
        }
    }
}
