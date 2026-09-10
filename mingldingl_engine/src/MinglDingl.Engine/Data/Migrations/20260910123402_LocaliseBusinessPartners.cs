using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class LocaliseBusinessPartners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CategoryMn",
                table: "BusinessPartners",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionMn",
                table: "BusinessPartners",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DistrictMn",
                table: "BusinessPartners",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameMn",
                table: "BusinessPartners",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoryMn",
                table: "BusinessPartners");

            migrationBuilder.DropColumn(
                name: "DescriptionMn",
                table: "BusinessPartners");

            migrationBuilder.DropColumn(
                name: "DistrictMn",
                table: "BusinessPartners");

            migrationBuilder.DropColumn(
                name: "NameMn",
                table: "BusinessPartners");
        }
    }
}
