using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class PerSideMessageCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InitiatorMessageCount",
                table: "Matches",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ReceiverMessageCount",
                table: "Matches",
                type: "integer",
                nullable: false,
                defaultValue: 0);
            // Existing conversations already earned their reveal level from the combined count.
            // Recover the per-side split from the messages themselves so nobody's live match drops
            // a rung the moment this deploys; matches with no rows keep their stored floor.
            migrationBuilder.Sql("""
                UPDATE "Matches" m SET
                    "InitiatorMessageCount" = COALESCE(c.initiator, 0),
                    "ReceiverMessageCount"  = COALESCE(c.receiver, 0)
                FROM (
                    SELECT mm.match_id,
                           COUNT(*) FILTER (WHERE mm.sender_id = mt."InitiatorId") AS initiator,
                           COUNT(*) FILTER (WHERE mm.sender_id = mt."ReceiverId")  AS receiver
                    FROM messages mm
                    JOIN "Matches" mt ON mt."Id" = mm.match_id
                    GROUP BY mm.match_id
                ) c
                WHERE c.match_id = m."Id";
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InitiatorMessageCount",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "ReceiverMessageCount",
                table: "Matches");
        }
    }
}
