using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class PairUniquenessAndInviteBinding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SlotAPhoneNumber",
                table: "Ships",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SlotBPhoneNumber",
                table: "Ships",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InitiatorVideoTokenAt",
                table: "Matches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReceiverVideoTokenAt",
                table: "Matches",
                type: "timestamp with time zone",
                nullable: true);

            // A pair may hold at most one Match, ever: PairAlreadyMatchedAsync counts a row of any
            // status, so unmatching does not free the pair up again. Until now that invariant lived
            // only in pg_advisory_xact_lock, taken by each of the four paths that can create a
            // match — one path forgetting it, or an execution-strategy retry replaying an insert,
            // produced a silent duplicate rather than an error. LEAST/GREATEST because the pair is
            // unordered: (a,b) and (b,a) are the same two people.
            //
            // Duplicates that nothing references are race artifacts and are dropped here. One with
            // history attached is a real data problem — two live conversations for one pair — so it
            // is left for a human and the index creation below fails loudly on it rather than
            // deciding on its own which of the two to destroy.
            migrationBuilder.Sql(@"
                DELETE FROM ""Matches"" m
                WHERE EXISTS (
                        SELECT 1 FROM ""Matches"" k
                        WHERE LEAST(k.""InitiatorId"", k.""ReceiverId"") = LEAST(m.""InitiatorId"", m.""ReceiverId"")
                          AND GREATEST(k.""InitiatorId"", k.""ReceiverId"") = GREATEST(m.""InitiatorId"", m.""ReceiverId"")
                          AND (k.""CreatedAt"", k.""Id"") < (m.""CreatedAt"", m.""Id""))
                  -- snake_case and lowercase: messages is the one table carried over from the
                  -- original Supabase schema, so it keeps that schema's naming.
                  AND NOT EXISTS (SELECT 1 FROM messages                c WHERE c.match_id           = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""DateConfirmations""    c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""IcebreakerResponses""  c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""QuizResponses""        c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""ActivitySuggestions""  c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""BusinessRatings""      c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""CampaignRoomClaims""   c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""ScoreEvents""          c WHERE c.""MatchId""          = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""Ships""                c WHERE c.""ResultMatchId""    = m.""Id"")
                  AND NOT EXISTS (SELECT 1 FROM ""TownSquarePairings""   c WHERE c.""ResultingMatchId"" = m.""Id"");
            ");

            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX ix_matches_pair
                ON ""Matches"" (LEAST(""InitiatorId"", ""ReceiverId""), GREATEST(""InitiatorId"", ""ReceiverId""));
            ");

            // Postgres treats NULLs as distinct, so IX_QuizResponses_QuizId_UserId_MatchId does not
            // constrain the standalone quiz at all — every row there has MatchId IS NULL. Concurrent
            // POSTs each passed the check-then-insert and each collected a QuizDone award. Keep the
            // earliest answer per quiz and let the index settle the race from here.
            migrationBuilder.Sql(@"
                DELETE FROM ""QuizResponses"" q
                WHERE q.""MatchId"" IS NULL
                  AND EXISTS (
                        SELECT 1 FROM ""QuizResponses"" k
                        WHERE k.""MatchId"" IS NULL
                          AND k.""QuizId"" = q.""QuizId"" AND k.""UserId"" = q.""UserId""
                          AND k.""Id"" < q.""Id"");
            ");

            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX ix_quiz_responses_standalone
                ON ""QuizResponses"" (""QuizId"", ""UserId"")
                WHERE ""MatchId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ix_quiz_responses_standalone;");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ix_matches_pair;");

            migrationBuilder.DropColumn(
                name: "SlotAPhoneNumber",
                table: "Ships");

            migrationBuilder.DropColumn(
                name: "SlotBPhoneNumber",
                table: "Ships");

            migrationBuilder.DropColumn(
                name: "InitiatorVideoTokenAt",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "ReceiverVideoTokenAt",
                table: "Matches");
        }
    }
}
