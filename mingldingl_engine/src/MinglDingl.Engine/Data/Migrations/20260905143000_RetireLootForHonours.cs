using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MinglDingl.Engine.Data.Migrations
{
    /// <summary>
    /// Data-only: the random loot catalogue (frames, emblems, three generic titles) was retired in
    /// favour of named honours and tier-derived frames. Rows and equipped ids that point at retired
    /// items go, so nothing in the inventory or the pending-reward toasts references an item the
    /// catalogue no longer knows. No schema change, so no snapshot change.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260905143000_RetireLootForHonours")]
    public partial class RetireLootForHonours : Migration
    {
        private const string Honours =
            "'title_oathkeeper','title_flamekeeper','title_sealbreaker','title_threadweaver','title_fateseer'," +
            "'title_bondkeeper','title_allycaller','title_trueword','title_sevendawns'";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""DELETE FROM "UserItems" WHERE "ItemId" NOT IN ({Honours});""");
            migrationBuilder.Sql($"""UPDATE "Users" SET "EquippedTitleId" = NULL WHERE "EquippedTitleId" IS NOT NULL AND "EquippedTitleId" NOT IN ({Honours});""");
            migrationBuilder.Sql("""UPDATE "Users" SET "EquippedFrameId" = NULL WHERE "EquippedFrameId" IS NOT NULL;""");
            migrationBuilder.Sql($"""UPDATE "Referrals" SET "InviterRewardItemId" = NULL WHERE "InviterRewardItemId" IS NOT NULL AND "InviterRewardItemId" NOT IN ({Honours});""");
            migrationBuilder.Sql("""UPDATE "Referrals" SET "InviteeRewardItemId" = NULL WHERE "InviteeRewardItemId" IS NOT NULL;""");
            migrationBuilder.Sql($"""UPDATE "Ships" SET "ShipperRewardItemId" = NULL WHERE "ShipperRewardItemId" IS NOT NULL AND "ShipperRewardItemId" NOT IN ({Honours});""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Retired items cannot be restored: the rows are gone.
        }
    }
}
