using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <summary>
    /// <c>FixGuidesMnGemNames</c> pulled the top three gem tiers onto their classical Mongolian
    /// names (Индранил / Бадмаараг / Маргад) but left the bottom three as Russian loanwords
    /// (Гранат / Опал / Аметист), so the ladder changed register halfway up: it opened in the
    /// vocabulary of a chemistry textbook and closed in the vocabulary of a sutra. That break falls
    /// exactly where the product is asking the reader to feel an ascent.
    ///
    /// The bottom three are pulled up to match rather than the top three pulled down: Анар
    /// (pomegranate, for garnet's colour and its name's own root), Солонго (rainbow, for opal's
    /// play-of-colour) and Болор (crystal, one of the classical treasure words). Single words, so
    /// they still fit the tier chips the loanwords fitted.
    ///
    /// Targeted `replace` rather than a body rewrite, for the reason given in
    /// <c>FixGuidesMnGemNames</c>: ContentPages is admin-editable at runtime and a deploy must not
    /// discard edits made there. The replacements are substring-safe in both directions — the only
    /// inflected form present is Гранатаас, which declines the same way once the stem is swapped,
    /// and neither the old nor the new names occur inside any other word in the body.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260908060000_MongolianGemNamesNativeRegister")]
    public partial class MongolianGemNamesNativeRegister : Migration
    {
        private const string ToNative = @"
UPDATE ""ContentPages"" SET ""BodyMn"" =
    replace(replace(replace(""BodyMn"", 'Гранат', 'Анар'), 'Опал', 'Солонго'), 'Аметист', 'Болор')
WHERE ""Slug"" = 'guides';";

        private const string ToLoanwords = @"
UPDATE ""ContentPages"" SET ""BodyMn"" =
    replace(replace(replace(""BodyMn"", 'Анар', 'Гранат'), 'Солонго', 'Опал'), 'Болор', 'Аметист')
WHERE ""Slug"" = 'guides';";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
            => migrationBuilder.Sql(ToNative);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
            => migrationBuilder.Sql(ToLoanwords);
    }
}
