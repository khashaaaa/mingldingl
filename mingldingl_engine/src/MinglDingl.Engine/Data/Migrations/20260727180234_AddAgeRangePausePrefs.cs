using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAgeRangePausePrefs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AgeMax",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 99);

            migrationBuilder.AddColumn<int>(
                name: "AgeMin",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 18);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgeMax",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AgeMin",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "Users");
        }
    }
}
