using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTownSquare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TownSquareSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RsvpOpensAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RsvpClosesAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScheduledStartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CurrentRoundNumber = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TownSquareSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TownSquareRounds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundNumber = table.Column<int>(type: "integer", nullable: false),
                    IcebreakerId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TownSquareRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TownSquareRounds_Icebreakers_IcebreakerId",
                        column: x => x.IcebreakerId,
                        principalTable: "Icebreakers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TownSquareRounds_TownSquareSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "TownSquareSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TownSquareRsvps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RsvpAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TownSquareRsvps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TownSquareRsvps_TownSquareSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "TownSquareSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TownSquareRsvps_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TownSquarePairings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserBId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAResponse = table.Column<string>(type: "text", nullable: false),
                    UserBResponse = table.Column<string>(type: "text", nullable: false),
                    UserAJoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UserBJoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResultingMatchId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TownSquarePairings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TownSquarePairings_TownSquareRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "TownSquareRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TownSquarePairings_Users_UserAId",
                        column: x => x.UserAId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TownSquarePairings_Users_UserBId",
                        column: x => x.UserBId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TownSquareIcebreakerResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PairingId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Answer = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_TownSquarePairings_RoundId",
                table: "TownSquarePairings",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_TownSquarePairings_UserAId",
                table: "TownSquarePairings",
                column: "UserAId");

            migrationBuilder.CreateIndex(
                name: "IX_TownSquarePairings_UserBId",
                table: "TownSquarePairings",
                column: "UserBId");

            migrationBuilder.CreateIndex(
                name: "IX_TownSquareRounds_IcebreakerId",
                table: "TownSquareRounds",
                column: "IcebreakerId");

            migrationBuilder.CreateIndex(
                name: "IX_TownSquareRounds_SessionId_RoundNumber",
                table: "TownSquareRounds",
                columns: new[] { "SessionId", "RoundNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TownSquareRsvps_SessionId_UserId",
                table: "TownSquareRsvps",
                columns: new[] { "SessionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TownSquareRsvps_UserId",
                table: "TownSquareRsvps",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TownSquareIcebreakerResponses");

            migrationBuilder.DropTable(
                name: "TownSquareRsvps");

            migrationBuilder.DropTable(
                name: "TownSquarePairings");

            migrationBuilder.DropTable(
                name: "TownSquareRounds");

            migrationBuilder.DropTable(
                name: "TownSquareSessions");
        }
    }
}
