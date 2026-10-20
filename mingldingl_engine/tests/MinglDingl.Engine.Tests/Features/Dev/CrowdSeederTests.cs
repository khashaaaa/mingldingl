using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Dev;

public class CrowdSeederTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public void Crowd_file_covers_every_state_and_edge_and_stays_inside_the_rules()
    {
        var crowd = CrowdSeeder.Load();
        crowd.Should().HaveCount(48);
        crowd.Select(c => c.Phone).Should().OnlyHaveUniqueItems();
        crowd.Where(c => c.State == "Onboarding").Select(c => c.Step).Should().BeEquivalentTo([1, 2, 3, 4, 5, 6]);
        crowd.Select(c => c.State).Distinct().Should().BeEquivalentTo(["Finished", "Onboarding", "Suspended", "Deleted"]);
        crowd.Select(c => c.City).Distinct().Should().HaveCount(MongoliaGeo.All.Count);
        crowd.Should().OnlyContain(c => MongoliaGeo.IsKnown(c.City) && ProfileService.Oaths.Contains(c.Oath)
            && ProfileService.Genders.Contains(c.Gender) && ProfileService.Locales.Contains(c.Locale)
            && c.Name.Length <= 40 && c.Bio.Length <= 300 && c.Age >= 18 && c.Age <= 99);
        crowd.Should().Contain(c => c.Bio.Length == 300).And.Contain(c => c.Photos == 6)
            .And.Contain(c => c.Edge == "turns18today");
        foreach (var c in crowd)
            for (var i = 0; i < c.Photos; i++)
                File.Exists(Path.Combine(AppContext.BaseDirectory, "Seed", "crowd", $"{c.Id}_{i}.jpg")).Should().BeTrue(c.Id);
    }

    [Fact]
    public async Task Seeding_twice_lands_every_person_in_their_state_without_new_uploads()
    {
        await using var f = new EngineFactory(db);
        f.UseMemoryPhotoStore();
        await using var scope = f.Services.CreateAsyncScope();
        var seeder = scope.ServiceProvider.GetRequiredService<CrowdSeeder>();
        var crowd = await seeder.ApplyAsync();
        var store = scope.ServiceProvider.GetRequiredService<AppDb>();
        var photoIds = await store.Set<Photo>().Select(p => p.Id).OrderBy(x => x).ToListAsync();

        await seeder.ApplyAsync();

        (await store.Set<Photo>().Select(p => p.Id).OrderBy(x => x).ToListAsync()).Should().Equal(photoIds);
        var profiles = scope.ServiceProvider.GetRequiredService<ProfileService>();
        foreach (var c in crowd)
        {
            var account = await store.Set<Account>().AsNoTracking().SingleAsync(a => a.Phone == c.Phone);
            var me = await profiles.MeAsync(account.Id);
            if (c.State != "Deleted") me.OnboardingStep.Should().Be(c.Step, c.Id); // a deleted account has no photos, so its step means nothing
            me.Status.Should().Be(c.State is "Suspended" or "Deleted" ? c.State : "Active", c.Id);
            (await store.Set<Photo>().CountAsync(p => p.AccountId == account.Id)).Should().Be(c.Photos, c.Id);
            (await store.Set<DeviceSession>().CountAsync(d => d.AccountId == account.Id)).Should().Be(c.Devices.Count, c.Id);
            if (c.Edge == "turns18today") me.Profile!.Age.Should().Be(18);
            else if (me.Profile is not null) me.Profile.Age.Should().Be(c.Age, c.Id);
        }
    }

    /// The world, read back through the services the app uses: every hero bond renders, the seals
    /// match the letters, points match the deeds, nobody holds more live bonds than their seats,
    /// and a second run lands the same world.
    [Fact]
    public async Task World_gives_the_hero_every_stage_and_stays_inside_the_rules()
    {
        await using var f = new EngineFactory(db);
        f.UseMemoryPhotoStore();
        await using var scope = f.Services.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var crowd = await sp.GetRequiredService<CrowdSeeder>().ApplyAsync();
        var dev = sp.GetRequiredService<DevSeeder>();
        var hero = await dev.EnsureAccountAsync("99123456");
        await dev.ApplyAsync(hero, SeedState.Finished);
        var store = sp.GetRequiredService<AppDb>();
        var world = sp.GetRequiredService<WorldSeeder>();

        await world.ApplyAsync(crowd, hero);
        var counts = (await store.Set<Bond>().CountAsync(), await store.Set<Letter>().CountAsync(), await store.Set<Venue>().CountAsync());
        store.ChangeTracker.Clear();
        await world.ApplyAsync(crowd, hero);
        (await store.Set<Bond>().CountAsync(), await store.Set<Letter>().CountAsync(), await store.Set<Venue>().CountAsync())
            .Should().Be(counts);

        var rows = await sp.GetRequiredService<BondService>().ListAsync(hero);
        rows.Should().HaveCount(13);
        rows.Count(r => r.State == "Live").Should().Be(7);
        rows.Select(r => r.State).Distinct().Should().BeEquivalentTo(["Live", "Cold", "Severed", "Faded"]);
        rows.Should().Contain(r => r.Embers).And.Contain(r => r.MyTurn).And.Contain(r => r.State == "Live" && r.LastLetter == null);
        foreach (var r in rows.Where(r => r.State == "Live"))
            await sp.GetRequiredService<EncounterService>().GetAsync(hero, r.Id);
        var log = await sp.GetRequiredService<HonourService>().LogAsync(hero);
        log.Standing.Kept.Should().Be(2);
        log.Standing.OpenScars.Should().Be(0);
        log.Encounters.Should().Contain(e => e.Outcome == "noShow");

        var config = sp.GetRequiredService<IConfig>();
        var seals = new[] { ConfigKeys.Seal1, ConfigKeys.Seal2, ConfigKeys.Seal3, ConfigKeys.Seal4 }.Select(config.Int).ToArray();
        foreach (var b in await store.Set<Bond>().AsNoTracking().ToListAsync())
        {
            b.Seals.Should().Be(seals.Count(t => b.Mutual >= t), b.Id.ToString());
            (await store.Set<Letter>().CountAsync(l => l.BondId == b.Id && l.AuthorId == b.AId)).Should().Be(b.LettersA);
            (await store.Set<Letter>().CountAsync(l => l.BondId == b.Id && l.AuthorId == b.BId)).Should().Be(b.LettersB);
        }
        foreach (var p in await store.Set<MinglDingl.Engine.Features.Profile.Profile>().AsNoTracking().Where(p => p.WelcomedAt != null).ToListAsync())
        {
            var sum = await store.Set<ScoreEvent>().Where(e => e.AccountId == p.AccountId).SumAsync(e => e.Amount);
            p.Points.Should().Be(Math.Max(0, sum), p.Name);
            p.Tier.Should().Be(Tiers.For(p.Points, config), p.Name);
            (await store.Set<Bond>().CountAsync(b => b.State == BondState.Live && (b.AId == p.AccountId || b.BId == p.AccountId)))
                .Should().BeLessThanOrEqualTo(config.Int(ConfigKeys.SeatsBase) + Tiers.Index(p.Tier), p.Name);
        }
    }
}
