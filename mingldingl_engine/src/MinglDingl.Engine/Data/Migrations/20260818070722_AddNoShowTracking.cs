using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNoShowTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NoShowFlagCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "DateConfirmations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "InitiatorAttended",
                table: "DateConfirmations",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PenaltyApplied",
                table: "DateConfirmations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReceiverAttended",
                table: "DateConfirmations",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NoShowFlagCount",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "DateConfirmations");

            migrationBuilder.DropColumn(
                name: "InitiatorAttended",
                table: "DateConfirmations");

            migrationBuilder.DropColumn(
                name: "PenaltyApplied",
                table: "DateConfirmations");

            migrationBuilder.DropColumn(
                name: "ReceiverAttended",
                table: "DateConfirmations");
        }
    }
}
