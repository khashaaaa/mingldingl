using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLastMessageSenderId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LastMessageSenderId",
                table: "Matches",
                type: "uuid",
                nullable: true);

            // Backfill existing matches from their most recent message so already-stale
            // matches aren't skipped by the ghosting sweep until someone messages again.
            migrationBuilder.Sql(@"
                UPDATE ""Matches"" m
                SET ""LastMessageSenderId"" = lm.sender_id
                FROM (
                    SELECT DISTINCT ON (match_id) match_id, sender_id
                    FROM messages
                    ORDER BY match_id, created_at DESC
                ) lm
                WHERE m.""Id"" = lm.match_id;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastMessageSenderId",
                table: "Matches");
        }
    }
}
