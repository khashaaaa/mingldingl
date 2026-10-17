using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
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

    /// crowd-world.json is read by the stage 3–6 seeders; until then it must already be consistent.
    [Fact]
    public void Crowd_world_refers_only_to_crowd_people_and_never_contradicts_itself()
    {
        var crowd = CrowdSeeder.Load().ToDictionary(c => c.Phone);
        using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Seed", "crowd", "crowd-world.json")));
        var w = doc.RootElement;
        string P(System.Text.Json.JsonElement e, string k) => e.GetProperty(k).GetString()!;

        foreach (var s in w.GetProperty("standing").EnumerateArray())
            crowd[P(s, "phone")].State.Should().NotBe("Onboarding");
        var tiers = w.GetProperty("standing").EnumerateArray().Select(s => P(s, "tier")).Distinct();
        tiers.Should().BeEquivalentTo(["Garnet", "Opal", "Amethyst", "Sapphire", "Ruby", "Emerald"]);

        var blocked = w.GetProperty("blocks").EnumerateArray()
            .Select(b => (P(b, "by"), P(b, "blocked"))).ToList();
        blocked.Should().OnlyContain(b => crowd.ContainsKey(b.Item1) && crowd.ContainsKey(b.Item2) && b.Item1 != b.Item2);

        var pairs = new HashSet<(string, string)>();
        foreach (var m in w.GetProperty("matches").EnumerateArray())
        {
            var (a, b) = (P(m, "a"), P(m, "b"));
            crowd.Should().ContainKey(a).And.ContainKey(b);
            crowd[a].Gender.Should().NotBe(crowd[b].Gender, $"{a}–{b}");
            pairs.Add((a, b)).Should().BeTrue($"{a}–{b} matched twice");
            if (P(m, "status") == "Active")
                blocked.Should().NotContain(x => (x.Item1 == a && x.Item2 == b) || (x.Item1 == b && x.Item2 == a));
        }
        foreach (var r in w.GetProperty("reports").EnumerateArray())
            crowd.Should().ContainKey(P(r, "by")).And.ContainKey(P(r, "against"));
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
}
