using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOath : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Oath",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OathProven",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "OathSwornAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Oath",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OathProven",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OathSwornAt",
                table: "Users");
        }
    }
}
