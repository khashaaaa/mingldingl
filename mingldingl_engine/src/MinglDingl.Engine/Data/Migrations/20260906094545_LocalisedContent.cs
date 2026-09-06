using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class LocalisedContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TitleEn",
                table: "Quizzes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "OptionsEn",
                table: "QuizQuestions",
                type: "text[]",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TextEn",
                table: "QuizQuestions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "OptionsEn",
                table: "Icebreakers",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuestionTextEn",
                table: "Icebreakers",
                type: "text",
                nullable: true);
            // English for the content that already exists. Matched on the Mongolian text so this is
            // idempotent and safe to re-run; anything unmatched simply stays untranslated and falls
            // back to Mongolian, which is the documented behaviour rather than a blank prompt.
            migrationBuilder.Sql("""
                UPDATE "Icebreakers" SET "QuestionTextEn" = v.en, "OptionsEn" = v.opts::jsonb
                FROM (VALUES
                  ('Хамгийн сүүлд юунд чин сэтгэлээсээ инээсэн бэ?', 'What last made you laugh for real?', '[]'),
                  ('Төгс амралтын өдөр чиний хувьд ямар байдаг вэ?', 'What does a perfect day off look like to you?', '[]'),
                  ('Хэрэв маргааш нүүх боломжтой бол хаашаа явах вэ?', 'If you could move tomorrow, where would you go?', '[]'),
                  ('Ямар нэг зүйлийг дахин сурч эхлэх боломж гарвал юу сурах вэ?', 'If you could start learning something over, what would it be?', '[]'),
                  ('Аль нь чамд илүү тохирох вэ?', 'Which one suits you better?',
                     '["A mountain trek","The seaside","A city cafe","A book at home"]'),
                  ('Өглөө эрт босдог уу, шөнө сүүл болтол сэрүүн байдаг уу?', 'Early riser, or up late into the night?',
                     '["Morning bird","Night owl","A bit of both"]'),
                  ('Анхны болзоонд хамгийн чухал нь юу вэ?', 'What matters most on a first date?',
                     '["Humour","Sincerity","Curiosity","Calm"]')
                ) AS v(mn, en, opts)
                WHERE "Icebreakers"."QuestionText" = v.mn;
                """);

            migrationBuilder.Sql("""
                UPDATE "Quizzes" SET "TitleEn" = v.en
                FROM (VALUES
                  ('Хамтын амьдралын хэв маяг', 'Ways of living together'),
                  ('Үнэт зүйлсийн сорил', 'A trial of values')
                ) AS v(mn, en)
                WHERE "Quizzes"."Title" = v.mn;
                """);

            migrationBuilder.Sql("""
                UPDATE "QuizQuestions" SET "TextEn" = v.en, "OptionsEn" = v.opts
                FROM (VALUES
                  ('Амралтын өдөр хэрхэн өнгөрүүлэх дуртай вэ?', 'How do you like to spend a day off?',
                     ARRAY['Active outdoors','Quiet at home','With friends','Travelling']),
                  ('Мөнгөө хэрхэн зарцуулдаг вэ?', 'How do you handle money?',
                     ARRAY['I save','I spend it on experiences','Balanced','I do not plan it']),
                  ('Маргаан гарвал юу хийдэг вэ?', 'What do you do in an argument?',
                     ARRAY['Talk it out at once','Take time to think','Avoid it','Ask someone outside']),
                  ('Гэр бүлийн үүрэг хуваарилалт?', 'How should a household divide its work?',
                     ARRAY['Split evenly','By who is better at it','Flexibly','We decide together']),
                  ('Юу чамд хамгийн чухал вэ?', 'What matters most to you?',
                     ARRAY['Family','Career','Freedom','Stability']),
                  ('Итгэлийг хэрхэн байгуулдаг вэ?', 'How is trust built?',
                     ARRAY['With time','With open talk','Through actions','Through shared experience']),
                  ('Ирээдүйгээ хэрхэн төлөвлөдөг вэ?', 'How do you plan ahead?',
                     ARRAY['In detail','A general direction','I go with the flow','We decide together'])
                ) AS v(mn, en, opts)
                WHERE "QuizQuestions"."Text" = v.mn;
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TitleEn",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "OptionsEn",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "TextEn",
                table: "QuizQuestions");

            migrationBuilder.DropColumn(
                name: "OptionsEn",
                table: "Icebreakers");

            migrationBuilder.DropColumn(
                name: "QuestionTextEn",
                table: "Icebreakers");
        }
    }
}
