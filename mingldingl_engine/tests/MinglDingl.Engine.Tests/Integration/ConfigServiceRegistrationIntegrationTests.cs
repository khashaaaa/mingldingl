using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>
/// <c>ConfigService</c> is deliberately <c>AddSingleton</c> in
/// <see cref="ServiceCollectionExtensions.AddApplicationServices"/> — one process-wide cache warmed
/// once at boot (<c>Program.cs</c>'s startup block) and shared by every request scope after. Every
/// other config test in this project (<see cref="AdminConfigControllerIntegrationTests"/> included)
/// builds its own <c>new ConfigService()</c> and hands the same instance to both the writer and the
/// reader by hand, so none of them would notice a regression to <c>AddScoped</c> — the bug this test
/// exists to catch.
///
/// This test instead builds the real DI container the way <c>Program.cs</c> does — a bare
/// <see cref="ServiceCollection"/> through the actual <see cref="ServiceCollectionExtensions.AddApplicationServices"/>
/// call — boots it with one scope (mirroring <c>Program.cs</c>'s seed-then-<c>LoadCacheAsync</c>
/// block), writes a score config value through <see cref="AdminConfigController"/> in a second,
/// independent scope (standing in for the admin request), and reads it back through
/// <see cref="ScoreService"/> in a third, separate scope (standing in for an unrelated user
/// request). That only works if every scope's <c>ConfigService</c> is the same warm singleton; regress
/// the registration to <c>AddScoped</c> and the read-scope's <c>ScoreService</c> gets its own empty
/// <c>ConfigService</c> that never saw the write (and never had <c>LoadCacheAsync</c> called on it
/// either — only the boot scope's instance did), so <c>Delta</c> falls back to the
/// <see cref="ScoreService.DefaultDeltas"/> literal instead of the admin-set value. Confirmed by
/// temporarily changing the registration to <c>AddScoped</c> and watching this go red (see
/// task-13-report.md) — every other test in the project still passed.
///
/// Runs against the real local Postgres (like <see cref="MessageSendRetryIntegrationTests"/>, this
/// opens its own connection outside <see cref="IntegrationTestBase"/>'s per-test rollback
/// transaction, so it owns its own cleanup) and is serialised for the same reason: a table-wide
/// write should not race whatever else is touching AdminConfigs.
/// </summary>
[Collection(SerialCollection.Name)]
public class ConfigServiceRegistrationIntegrationTests
{
    private const string ConnectionString =
        "Host=127.0.0.1;Database=mingldingl;Username=postgres;Password=1234;Port=5432";

    /// <summary>An existing, bounded (1-10000) scoring key — see <c>ConfigKeys.ScoreEvents</c> — so
    /// a bogus value here can never slip past <c>AdminConfigController</c>'s own validation.</summary>
    private const string Key = "score.event.DailyLogin";

    private static ServiceProvider BuildRealAppContainer()
    {
        var services = new ServiceCollection();
        services.AddLogging();

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(ConnectionString);
        dataSourceBuilder.EnableDynamicJson();
        var dataSource = dataSourceBuilder.Build();
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseNpgsql(dataSource, npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3))
               .ConfigureWarnings(w => w.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning)));

        // The exact registration under test — nothing hand-rolled here.
        services.AddApplicationServices();
        return services.BuildServiceProvider();
    }

    private static HttpContext AdminHttpContext()
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, "config-registration-test-admin")], "AdminBearer");
        return new DefaultHttpContext { User = new ClaimsPrincipal(identity) };
    }

    [Fact]
    public async Task AdminConfigWrite_IsVisibleTo_ScoreServiceResolvedInADifferentScope()
    {
        await using var provider = BuildRealAppContainer();
        string originalValue;

        // Boot scope: seed any missing keys and warm the cache, exactly like Program.cs's startup
        // block. If ConfigService is scoped, the instance warmed here is thrown away with the scope.
        using (var bootScope = provider.CreateScope())
        {
            var db = bootScope.ServiceProvider.GetRequiredService<AppDbContext>();
            await AdminConfigSeeder.SeedAsync(db, NullLogger.Instance);
            originalValue = await db.AdminConfigs.Where(c => c.Key == Key).Select(c => c.Value).SingleAsync();

            var config = bootScope.ServiceProvider.GetRequiredService<ConfigService>();
            await config.LoadCacheAsync(db);
        }

        try
        {
            // Admin scope: a fresh scope, standing in for the AdminBearer-authenticated HTTP
            // request that would normally host this controller.
            using (var adminScope = provider.CreateScope())
            {
                var db = adminScope.ServiceProvider.GetRequiredService<AppDbContext>();
                var config = adminScope.ServiceProvider.GetRequiredService<ConfigService>();
                var audit = adminScope.ServiceProvider.GetRequiredService<AdminAuditService>();
                var score = adminScope.ServiceProvider.GetRequiredService<ScoreService>();
                var controller = new AdminConfigController(db, config, audit, score)
                {
                    ControllerContext = new ControllerContext { HttpContext = AdminHttpContext() },
                };

                var result = await controller.Update(Key, new UpdateConfigRequest("9"));
                Assert.IsType<OkObjectResult>(result);
            }

            // Read scope: a third, independent scope with no reference to either scope above —
            // standing in for an unrelated request computing a score delta later.
            using (var readScope = provider.CreateScope())
            {
                var score = readScope.ServiceProvider.GetRequiredService<ScoreService>();
                Assert.Equal(9, score.Delta("DailyLogin"));
            }
        }
        finally
        {
            await using var cleanup = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(ConnectionString)
                .ConfigureWarnings(w => w.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning))
                .Options);
            await cleanup.AdminConfigs.Where(c => c.Key == Key)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.Value, originalValue));
            await cleanup.AdminAuditLogs
                .Where(l => l.EntityType == "AdminConfig" && l.EntityId == Key && l.Action == "UpdateConfig"
                    && l.AdminUsername == "config-registration-test-admin")
                .ExecuteDeleteAsync();
        }
    }
}
