using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Quests;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Features.Square;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Payments;

public class FloorTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task A_paid_floor_widens_the_fire_and_losing_it_breaks_no_bond()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(MinglDingl.Engine.Kernel.Config.ConfigKeys.SafetyNewDays, "0"); // Bat is no newcomer here
        var bat = await w.PersonAsync("Bat", "Male");
        var yard = await bat.C.SeekAsync();
        yard.Floor.Should().Be("yard");

        await w.FloorAsync(bat, Floor.Hall, days: 30);
        var hall = await bat.C.SeekAsync();
        hall.Floor.Should().Be("hall");
        hall.CandlesPerDay.Should().Be(yard.CandlesPerDay + 12 - 5, "the Hall's base is 12 where the Yard's is 5");
        hall.Seats.Should().Be(yard.Seats + 2);

        // Fill the fire past the Yard's seats, then let the floor lapse.
        var women = new List<World.Person>();
        for (var i = 0; i < yard.Seats + 1; i++) women.Add(await w.PersonAsync($"W{i}", "Female"));
        foreach (var _ in women) await bat.C.SummonAsync((await bat.C.SeekAsync()).Candidate!.AccountId);
        (await bat.C.BondsAsync()).Should().HaveCount(yard.Seats + 1);

        await w.FloorAsync(bat, null);
        var lapsed = await bat.C.SeekAsync();
        lapsed.Floor.Should().Be("yard");
        lapsed.State.Should().Be("full", "no new bond until the fire is back under its seats");
        (await bat.C.BondsAsync()).Should().OnlyContain(b => b.State == "Live", "losing a floor never breaks a bond");
    }

    [Fact]
    public async Task Filters_and_a_second_look_are_the_Halls_and_filters_only_narrow()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male", oath: "Bond");
        var anu = await w.PersonAsync("Anu", "Female", oath: "Bond");
        var saraa = await w.PersonAsync("Saraa", "Female", oath: "Fate");

        (await CodeOf(await bat.C.PutAsJsonAsync("/seek/filters", new SeekFilterRequest(null, null, null, "Fate", null, null, null))))
            .Should().Be("membership.hall");
        (await CodeOf(await bat.C.PostAsync("/seek/second-look", null))).Should().Be("membership.hall");

        await w.FloorAsync(bat, Floor.Hall, days: 30);
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(anu.Id, "the same oath comes first for everyone");
        (await bat.C.PutAsJsonAsync("/seek/filters", new SeekFilterRequest(null, null, null, "Fate", null, null, null))).EnsureSuccessStatusCode();
        var filtered = await bat.C.SeekAsync();
        filtered.Filtered.Should().BeTrue();
        filtered.Candidate!.AccountId.Should().Be(saraa.Id);

        (await bat.C.PutAsJsonAsync("/seek/filters", new SeekFilterRequest(null, null, null, null, null, null, null))).EnsureSuccessStatusCode();
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(anu.Id);
        (await bat.C.PostAsync($"/seek/{anu.Id}/pass", null)).EnsureSuccessStatusCode();
        var after = await bat.C.SeekAsync();
        after.Candidate!.AccountId.Should().Be(saraa.Id);
        after.SecondLook.Should().BeTrue();

        var back = await (await bat.C.PostAsync("/seek/second-look", null)).Read<SeekView>();
        back.Candidate!.AccountId.Should().Be(anu.Id);
        back.SecondLook.Should().BeFalse("one a night");
        (await CodeOf(await bat.C.PostAsync("/seek/second-look", null))).Should().Be("seek.second_look_used");
    }

    [Fact]
    public async Task The_deep_profile_is_filled_by_members_and_read_by_a_member_after_the_fourth_seal()
    {
        await using var w = await World.CreateAsync(db);
        foreach (var (k, v) in new[] { (ConfigKeys.Seal1, "1"), (ConfigKeys.Seal2, "2"), (ConfigKeys.Seal3, "3"), (ConfigKeys.Seal4, "4") })
            await w.SetAsync(k, v);
        var bat = await w.PersonAsync("Bat", "Male");
        var anu = await w.PersonAsync("Anu", "Female");

        var sealedDeep = (await anu.C.GetFromJsonAsync<MyDeepView>("/me/deep"))!;
        sealedDeep.Open.Should().BeFalse();
        (await CodeOf(await anu.C.PutAsJsonAsync("/me/deep", new DeepUpdateRequest(null, null, "yes", null, null, null, null, null))))
            .Should().Be("membership.hall");
        (await anu.C.PutAsJsonAsync("/me/deep", new DeepUpdateRequest("yes", null, null, null, null, null, null, null)))
            .EnsureSuccessStatusCode(); // whether she has children is everyone's to say

        await w.FloorAsync(anu, Floor.Hall, days: 30);
        (await CodeOf(await anu.C.PutAsJsonAsync("/me/deep", new DeepUpdateRequest(null, null, "lots", null, null, null, null, null))))
            .Should().Be("profile.deep");
        var mine = await (await anu.C.PutAsJsonAsync("/me/deep",
            new DeepUpdateRequest(null, null, "yes", "welcome", "never", null, "buddhist", null))).Read<MyDeepView>();
        mine.Answers.Should().Be(new DeepView("yes", "yes", "welcome", "never", null, "buddhist", null));
        mine.ShowChildren.Should().BeFalse();

        var bond = await bat.C.SummonAsync(anu.Id);
        await ExchangeAsync(bond.Id, bat.C, anu.C, 3);
        (await anu.C.BondAsync(bond.Id)).Other.Deep.Should().BeNull("before the fourth seal");
        await ExchangeAsync(bond.Id, bat.C, anu.C, 1);
        (await bat.C.BondAsync(bond.Id)).Seals.Should().Be(4);
        (await bat.C.BondAsync(bond.Id)).Other.Deep.Should().BeNull("Bat stands in the Yard");
        (await bat.C.BondAsync(bond.Id)).Other.HasChildren.Should().BeFalse("she keeps it for the fourth seal");
        await w.FloorAsync(bat, Floor.Hall, days: 30);
        (await bat.C.BondAsync(bond.Id)).Other.Deep!.PartnerChildren.Should().Be("welcome");
    }

    [Fact]
    public async Task A_ger_rest_keeps_a_members_streak_over_a_missed_dawn_once_a_moon_on_the_Hall()
    {
        await using var w = await World.CreateAsync(db);
        // The test clock starts on the 5th: every day here stays inside one moon.
        var bat = await w.PersonAsync("Bat", "Male");
        var dorj = await w.PersonAsync("Dorj", "Male");
        await w.FloorAsync(bat, Floor.Hall, days: 60);

        foreach (var p in new[] { bat, dorj }) (await p.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromDays(2));
        (await bat.C.GetFromJsonAsync<QuestBoard>("/me/quests"))!.Dawns.Should().Be(1, "a rest will keep the gap");
        (await (await bat.C.PostAsync("/me/dawn", null)).Read<DawnView>()).Streak.Should().Be(2);
        (await (await dorj.C.PostAsync("/me/dawn", null)).Read<DawnView>()).Streak.Should().Be(1, "the Yard has no ger rest");
        var board = (await bat.C.GetFromJsonAsync<QuestBoard>("/me/quests"))!;
        board.GerRests.Left.Should().Be(0);
        board.GerRests.KeptOn.Should().NotBeNull();

        await w.AdvanceAsync(TimeSpan.FromDays(2));
        (await (await bat.C.PostAsync("/me/dawn", null)).Read<DawnView>()).Streak.Should().Be(1, "this moon's rest is spent");
    }

    [Fact]
    public async Task The_High_Table_sits_first_at_a_new_bell()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.SquareHighTableLeadMinutes, "10");
        var bat = await w.PersonAsync("Bat", "Male");
        var dorj = await w.PersonAsync("Dorj", "Male");
        await w.FloorAsync(bat, Floor.HighTable, days: 30);
        var admin = await w.F.AdminAsync();
        (await admin.PostAsJsonAsync("/admin/gatherings",
            new GatheringWriteRequest("The Fourth Bell", w.F.Clock.UtcNow.AddHours(2), 3, 1, 8, null, false))).EnsureSuccessStatusCode();
        var g = (await bat.C.GetFromJsonAsync<SquareView>("/square"))!.Next!;
        g.SeatsOpenAt.Should().BeCloseTo(w.F.Clock.UtcNow.AddMinutes(10), TimeSpan.FromSeconds(5));

        (await CodeOf(await dorj.C.PostAsync($"/square/{g.Id}/seat", null))).Should().Be("square.high_table_first");
        (await bat.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromMinutes(11));
        (await dorj.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
    }
}

public static class FloorDriver
{
    /// Puts a person on a floor through the store (the fake RevenueCat), or back in the Yard with null.
    public static async Task FloorAsync(this World w, World.Person p, Floor? floor, int days = 30)
    {
        var now = w.F.Clock.UtcNow;
        w.Store().Accounts[p.Id] = floor is { } f
            ? [new StoreEntitlement(f, $"{Floors.Key(f)}:m1", now.AddMinutes(-1), now.AddDays(days), true, false)]
            : [];
        (await p.C.PostAsync("/me/membership/sync", null)).EnsureSuccessStatusCode();
    }
}
