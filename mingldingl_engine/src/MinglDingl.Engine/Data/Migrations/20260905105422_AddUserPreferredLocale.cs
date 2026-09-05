using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPreferredLocale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreferredLocale",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "en");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PreferredLocale",
                table: "Users");
        }
    }
}
