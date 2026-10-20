using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Kernel;

namespace MinglDingl.Engine.Features.Stats;

public sealed class StatsEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/admin").WithTags("Admin").RequireAuthorization(AdminEndpoints.Policy);
        // metrics: comma-separated keys of StatsService.Sources.
        g.MapGet("/stats", (string metrics, DateOnly from, DateOnly to, string? city, string? gender, string? age, string? tier,
                string? floor, StatsService stats, CancellationToken ct) =>
            stats.SeriesAsync(metrics.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), from, to,
                new StatFilter(city, gender, age, tier, floor), ct))
            .WithName("AdminStats");
        g.MapGet("/stats/tables/{group}", (string group, DateOnly from, DateOnly to, string? city, string? gender, string? age,
                string? tier, string? floor, StatsTables tables, CancellationToken ct) =>
            tables.TableAsync(group, from, to, new StatFilter(city, gender, age, tier, floor), ct))
            .WithName("AdminStatsTable");
        g.MapGet("/dashboard", (StatsTables tables, CancellationToken ct) => tables.DashboardAsync(ct)).WithName("AdminDashboard");
        g.MapGet("/deletions", (StatsTables tables, CancellationToken ct) => tables.DeletionsAsync(ct)).WithName("AdminDeletions");
        g.MapGet("/health", (StatsTables tables, CancellationToken ct) => tables.HealthAsync(ct)).WithName("AdminHealth");
        g.MapPost("/sweep", async (Kernel.Maintenance.DailySweep sweep, CancellationToken ct) =>
        {
            await sweep.RunAsync(ct);
            return Results.NoContent();
        }).WithName("AdminRunSweep");
    }
}

/// Every hour: any finished day not yet counted is rolled up (and yesterday again, for late events).
public sealed class StatsSweep(IServiceScopeFactory scopes, OpsClock ops, ILogger<StatsSweep> log) : BackgroundService
{
    public async Task RunAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var n = await scope.ServiceProvider.GetRequiredService<StatsService>().CatchUpAsync(ct);
        ops.StatsRolledAt = DateTimeOffset.UtcNow;
        if (n > 1) log.LogInformation("Stats: {Days} days rolled up", n);
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        // A first pass soon after boot, then hourly.
        try { await Task.Delay(TimeSpan.FromMinutes(1), stop); } catch (TaskCanceledException) { return; }
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try { await RunAsync(stop); }
            catch (Exception e) when (!stop.IsCancellationRequested) { log.LogError(e, "Stats rollup failed"); }
        } while (await timer.WaitForNextTickAsync(stop));
    }
}
