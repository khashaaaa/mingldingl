using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Campaign;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;

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
            await Questions.SeedAsync(db, ct);
            await CodexService.SeedAsync(db, DateTimeOffset.UtcNow, ct);
            await FestivalService.SeedAsync(db, scope.ServiceProvider.GetRequiredService<IClock>().TodayUb, ct);
        }
        await ConfigService.SeedAndLoadAsync(services);
        await HonourService.BackfillAsync(services, ct);
        await CampaignService.BackfillAsync(services, ct);
    }
}
