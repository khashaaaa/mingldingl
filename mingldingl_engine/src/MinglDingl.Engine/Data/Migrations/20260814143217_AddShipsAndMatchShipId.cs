using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShipsAndMatchShipId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShipId",
                table: "Matches",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Ships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShipperUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    SlotAUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SlotAInviteCode = table.Column<string>(type: "text", nullable: true),
                    SlotAOptIn = table.Column<string>(type: "text", nullable: false),
                    SlotBUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SlotBInviteCode = table.Column<string>(type: "text", nullable: true),
                    SlotBOptIn = table.Column<string>(type: "text", nullable: false),
                    ResultMatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    ShipperRewardItemId = table.Column<string>(type: "text", nullable: true),
                    ShipperNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ships", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Ships_ShipperUserId",
                table: "Ships",
                column: "ShipperUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Ships_SlotAUserId",
                table: "Ships",
                column: "SlotAUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Ships_SlotBUserId",
                table: "Ships",
                column: "SlotBUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Ships");

            migrationBuilder.DropColumn(
                name: "ShipId",
                table: "Matches");
        }
    }
}
