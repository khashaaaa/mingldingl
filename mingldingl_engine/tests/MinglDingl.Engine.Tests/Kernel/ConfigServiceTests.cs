using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Kernel;

public class ConfigServiceTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<EngineFactory> Start(PostgresFixture db)
    {
        var f = new EngineFactory(db);
        _ = f.Client(); // boots the host: migrate + seed + warm cache
        await Task.CompletedTask;
        return f;
    }

    [Fact]
    public async Task Seeder_inserts_missing_keys_and_keeps_edited_values()
    {
        await using (var f = await Start(db))
        {
            await using var scope = f.Services.CreateAsyncScope();
            var store = scope.ServiceProvider.GetRequiredService<AppDb>();
            (await store.Set<ConfigEntry>().CountAsync()).Should().Be(ConfigKeys.All.Count);
            await scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("photos.min", "4");
        }
        await using (var f = await Start(db)) // second boot re-runs the seeder
        {
            f.Services.GetRequiredService<IConfig>().Int("photos.min").Should().Be(4);
        }
    }

    [Fact]
    public async Task Set_outside_bounds_is_refused()
    {
        await using var f = await Start(db);
        await using var scope = f.Services.CreateAsyncScope();
        var act = () => scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("photos.max", "7");
        (await act.Should().ThrowAsync<DomainException>()).Which.Code.Should().Be("config.out_of_bounds");
    }

    [Fact]
    public async Task Unknown_key_is_404()
    {
        await using var f = await Start(db);
        await using var scope = f.Services.CreateAsyncScope();
        var act = () => scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("nope", "1");
        (await act.Should().ThrowAsync<DomainException>()).Which.Status.Should().Be(404);
    }

    [Fact]
    public async Task Set_updates_cache_without_restart()
    {
        await using var f = await Start(db);
        await using var scope = f.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("signups.enabled", "false");
        f.Services.GetRequiredService<IConfig>().Bool("signups.enabled").Should().BeFalse();
        await scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("signups.enabled", "true");
    }

    [Fact]
    public async Task Photos_min_cannot_exceed_photos_max()
    {
        await using var f = await Start(db);
        await using var scope = f.Services.CreateAsyncScope();
        var w = scope.ServiceProvider.GetRequiredService<ConfigWrites>();
        await w.SetAsync("photos.max", "4");
        var act = () => w.SetAsync("photos.min", "5");
        (await act.Should().ThrowAsync<DomainException>()).Which.Code.Should().Be("config.out_of_bounds");
        await w.SetAsync("photos.max", "6");
    }

    [Fact]
    public async Task Bool_key_refuses_non_bool()
    {
        await using var f = await Start(db);
        await using var scope = f.Services.CreateAsyncScope();
        var act = () => scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync("app.maintenance", "maybe");
        (await act.Should().ThrowAsync<DomainException>()).Which.Code.Should().Be("config.bad_value");
    }
}
