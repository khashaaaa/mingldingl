using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <summary>
    /// The Mongolian guides named the top three gem tiers with Russian loanwords
    /// (Сапфир / Рубин / Эмеральд) while the app's own Mongolian strings use the classical names
    /// (Индранил / Бадмаараг / Маргад), so a reader saw two different names for the same tier.
    ///
    /// Done as a targeted `replace` rather than rewriting the whole body, because ContentPages is
    /// admin-editable at runtime and overwriting it would discard any edits made there. The
    /// replacements are substring-safe: the declined forms (Рубинаар, Эмеральдад …) inflect the
    /// same way once the stem is swapped.
    /// </summary>
    public partial class FixGuidesMnGemNames : Migration
    {
        private const string ToClassical = @"
UPDATE ""ContentPages"" SET ""BodyMn"" =
    replace(replace(replace(""BodyMn"", 'Сапфир', 'Индранил'), 'Рубин', 'Бадмаараг'), 'Эмеральд', 'Маргад')
WHERE ""Slug"" = 'guides';";

        private const string ToLoanwords = @"
UPDATE ""ContentPages"" SET ""BodyMn"" =
    replace(replace(replace(""BodyMn"", 'Индранил', 'Сапфир'), 'Бадмаараг', 'Рубин'), 'Маргад', 'Эмеральд')
WHERE ""Slug"" = 'guides';";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
            => migrationBuilder.Sql(ToClassical);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
            => migrationBuilder.Sql(ToLoanwords);
    }
}
