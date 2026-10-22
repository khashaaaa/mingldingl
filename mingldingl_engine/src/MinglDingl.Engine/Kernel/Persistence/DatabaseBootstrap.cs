using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Campaign;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Kernel.Persistence;

/// The one place the database is brought up to date, in order: apply the migration, seed
/// reference data, load config, backfill rows older code never wrote. Boot (`Program.cs`) and the
/// `seed` CLI both call this, so a new seed or backfill is added here and nowhere else.
public static class DatabaseBootstrap
{
    public static async Task RunAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using (var scope = services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Database.MigrateAsync(ct);
            await LooseVerifyMnColumnsAsync(db, ct);
            await AddVenueMnColumnsAsync(db, ct);
            await AddFaceColumnsAsync(db, ct);
            await db.Database.ExecuteSqlRawAsync("""ALTER TABLE photos ADD COLUMN IF NOT EXISTS "SameHash" bigint;""", ct);
            await AddVerificationTriesAsync(db, ct);
            await Questions.SeedAsync(db, ct);
            await CodexService.SeedAsync(db, DateTimeOffset.UtcNow, ct);
            await Features.Wanderings.WanderingSeed.SeedAsync(db, DateTimeOffset.UtcNow, ct);
            await FestivalService.SeedAsync(db, scope.ServiceProvider.GetRequiredService<IClock>().TodayUb, ct);
        }
        await ConfigService.SeedAndLoadAsync(services);
        await HonourService.BackfillAsync(services, ct);
        await CampaignService.BackfillAsync(services, ct);
        await PhotoService.BackfillSameHashAsync(services, ct);
    }

    /// A database made before venues carried Mongolian address, hours and description (the server's
    /// and the dev one) gains the three columns; a no-op on a fresh one, which the migration made whole.
    private static Task AddVenueMnColumnsAsync(AppDb db, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync($$"""
            ALTER TABLE venues ADD COLUMN IF NOT EXISTS "AddressMn" character varying({{FieldLimits.VenueAddress}});
            ALTER TABLE venues ADD COLUMN IF NOT EXISTS "HoursMn" character varying({{FieldLimits.VenueHours}});
            ALTER TABLE venues ADD COLUMN IF NOT EXISTS "DescriptionMn" character varying({{FieldLimits.VenueDescription}});
            """, ct);

    /// A database made before the face check (the server's and the dev one) gains its profile columns
    /// and the Seek filter's; a no-op on a fresh one.
    private static Task AddFaceColumnsAsync(AppDb db, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "FaceProvenAt" timestamp with time zone;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "FaceTries" integer NOT NULL DEFAULT 0;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "FaceTriesDay" date;
            ALTER TABLE seek_filters ADD COLUMN IF NOT EXISTS "FaceProven" boolean;
            """, ct);

    /// A database made before wrong tries were counted here (the server's and the dev one) gains the
    /// column, and the index the day's text cap counts by; a no-op on a fresh one.
    private static Task AddVerificationTriesAsync(AppDb db, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS "WrongTries" integer NOT NULL DEFAULT 0;
            CREATE INDEX IF NOT EXISTS "IX_phone_verifications_CreatedAt" ON phone_verifications ("CreatedAt");
            """, ct);

    /// A database made before WeSend still has verify.mn's code columns, NOT NULL, which the model no
    /// longer writes; they are loosened (never dropped) so new rows insert. A no-op on a fresh one.
    private static Task LooseVerifyMnColumnsAsync(AppDb db, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync("""
            DO $$
            DECLARE c text;
            BEGIN
              FOREACH c IN ARRAY ARRAY['Code', 'DisplayInstruction', 'SmsUri'] LOOP
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name = 'phone_verifications' AND column_name = c AND is_nullable = 'NO') THEN
                  EXECUTE format('ALTER TABLE phone_verifications ALTER COLUMN %I DROP NOT NULL', c);
                END IF;
              END LOOP;
            END $$;
            """, ct);
}
