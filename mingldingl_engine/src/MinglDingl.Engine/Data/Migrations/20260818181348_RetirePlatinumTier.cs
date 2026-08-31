using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <inheritdoc />
    public partial class RetirePlatinumTier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Platinum was retired in favour of a three-rung ladder (Free/Silver/
            // Gold). Gold absorbed Platinum's match budget and its priority-
            // matching perk, so existing Platinum members move across with no
            // loss of entitlement and keep whatever expiry they already had.
            // Memberships rows are the purchase ledger and are deliberately left
            // untouched — they record what was actually bought at the time.
            migrationBuilder.Sql(@"UPDATE ""Users"" SET ""MembershipLevel"" = 'Gold' WHERE ""MembershipLevel"" = 'Platinum';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible: once merged into Gold there is no way to tell which
            // Gold members were originally Platinum. Reverting the code without
            // reverting the data is safe, since Gold remains a valid tier.
        }
    }
}
