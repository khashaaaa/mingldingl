using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <summary>
    /// The tier rings (one cosmetic frame per gem tier, worn by choice) were retired: the ring only
    /// restated the gem badge and nobody but the wearer ever saw it. The avatar ring now takes the
    /// tier colour on the client, so the column has nothing left to hold.
    /// </summary>
    public partial class RetireTierFrames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EquippedFrameId",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EquippedFrameId",
                table: "Users",
                type: "text",
                nullable: true);
        }
    }
}
