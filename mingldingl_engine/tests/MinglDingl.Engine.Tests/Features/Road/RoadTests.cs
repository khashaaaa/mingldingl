using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Hall;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Quests;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Road;

public class RoadTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task The_days_draw_is_fixed_and_always_lights_the_hearth_first()
    {
        var id = Guid.CreateVersion7();
        var day = new DateOnly(2026, 10, 10);
        var a = QuestService.DailyFor(id, day).Select(q => q.Kind).ToList();
        a.Should().Equal(QuestService.DailyFor(id, day).Select(q => q.Kind));
        a.Should().HaveCount(3).And.OnlyHaveUniqueItems();
        a[0].Should().Be(QuestKinds.LightHearth);
    }

    [Fact]
    public async Task A_quest_pays_once_when_done_and_the_days_last_claim_fills_a_chest()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        (await bat.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();

        var board = await Board(bat.C);
        board.Daily[0].Should().Match<QuestView>(q => q.Kind == QuestKinds.LightHearth && q.Done && !q.Claimed);
        var undone = board.Daily[1].Kind;
        (await CodeOf(await bat.C.PostAsync($"/me/quests/{undone}/claim", null))).Should().Be("quest.not_done");
        (await CodeOf(await bat.C.PostAsync("/me/quests/nonsense/claim", null))).Should().Be("quest.not_found");

        // The other two of today's quests were already claimed.
        await using (var scope = w.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            foreach (var q in board.Daily.Skip(1))
                dbx.Add(new QuestClaim { AccountId = bat.Id, Kind = q.Kind, Period = board.Day, Points = 0, ClaimedAt = w.F.Clock.UtcNow });
            await dbx.SaveChangesAsync();
        }

        var before = await bat.C.PointsAsync();
        var claim = await (await bat.C.PostAsync($"/me/quests/{QuestKinds.LightHearth}/claim", null)).Read<ClaimResult>();
        claim.Earned.Should().Be(20);
        claim.Chest.Should().NotBeNull("the day's three are all claimed");
        (await bat.C.PointsAsync()).Should().Be(before + 20);
        (await CodeOf(await bat.C.PostAsync($"/me/quests/{QuestKinds.LightHearth}/claim", null))).Should().Be("quest.claimed");

        var chests = (await bat.C.GetFromJsonAsync<List<ChestView>>("/me/chests"))!;
        chests.Should().ContainSingle().Which.Points.Should().Be(30);
        (await (await bat.C.PostAsync($"/me/chests/{chests[0].Id}/open", null)).Read<ChestOpened>()).Earned.Should().Be(30);
        (await CodeOf(await bat.C.PostAsync($"/me/chests/{chests[0].Id}/open", null))).Should().Be("chest.opened");
        (await bat.C.GetFromJsonAsync<List<ChestView>>("/me/chests"))!.Should().BeEmpty();
        (await bat.C.PointsAsync()).Should().Be(before + 50);
    }

    [Fact]
    public async Task A_claim_without_a_chest_still_writes_its_deed()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        (await bat.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();

        var claim = await (await bat.C.PostAsync($"/me/quests/{QuestKinds.LightHearth}/claim", null)).Read<ClaimResult>();
        claim.Chest.Should().BeNull("two of the day's quests are still open");
        var deeds = (await bat.C.GetFromJsonAsync<DeedPage>("/me/deeds?limit=1"))!;
        deeds.Items.Should().ContainSingle().Which.Should().Match<DeedView>(d => d.Kind == "quest" && d.Amount == 20);
    }

    [Fact]
    public async Task Honours_come_from_what_was_done_and_the_ceremony_plays_until_seen()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        (await bat.C.HonoursAsync()).Should().OnlyContain(h => !h.Earned);

        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 5);

        var hs = await bat.C.HonoursAsync();
        hs.Should().HaveCount(22);
        hs.Where(h => h.Earned).Select(h => h.Key).Should().BeEquivalentTo(HonourKeys.FirstBond, HonourKeys.SealBreaker);
        hs.Where(h => h.Earned).Should().OnlyContain(h => h.Unseen);

        (await bat.C.PostAsync($"/me/honours/{HonourKeys.SealBreaker}/seen", null)).EnsureSuccessStatusCode();
        (await bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.SealBreaker).Unseen.Should().BeFalse();
        (await bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.FirstBond).Unseen.Should().BeTrue();
    }

    [Fact]
    public async Task An_honour_is_written_and_announced_by_the_write_that_earns_it_and_reading_only_reads()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        await using var his = await w.F.ListenAsync(bat.S);

        await bat.C.SummonAsync(saruul.Id);
        (await his.WaitForAsync(MinglDingl.Engine.Kernel.Live.LiveKinds.HonourEarned)).Should().NotBeNull("the summons earned First Bond");
        await using (var scope = w.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            dbx.Set<HonourEarned>().Where(h => h.AccountId == bat.Id).Select(h => h.Key).ToList()
                .Should().Equal(HonourKeys.FirstBond);
            // History written with the watch off earns nothing until a write touches it: reading never checks.
            scope.ServiceProvider.GetRequiredService<HonourTouches>().Off = true;
            dbx.Add(new ScoreEvent { AccountId = bat.Id, Kind = DeedKinds.Rite, Amount = 0, Day = UbDays.DayOf(w.F.Clock.UtcNow), CreatedAt = w.F.Clock.UtcNow });
            await dbx.SaveChangesAsync();
        }
        (await bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.FaceToFlame).Earned.Should().BeFalse();
        await using (var scope = w.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            dbx.Add(new ScoreEvent { AccountId = bat.Id, Kind = DeedKinds.Rite, Amount = 0, Day = UbDays.DayOf(w.F.Clock.UtcNow), CreatedAt = w.F.Clock.UtcNow });
            await dbx.SaveChangesAsync();
        }
        (await bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.FaceToFlame).Earned.Should().BeTrue();
    }

    [Fact]
    public async Task A_festival_dated_after_the_encounter_still_earns_its_honour_and_the_board_counts_districts()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.AskedAsync();
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.HonoursAsync()).Single(h => h.Key == HonourKeys.Naadam).Earned.Should().BeFalse();
        (await m.Saruul.C.GetFromJsonAsync<QuestBoard>("/me/quests"))!.DistrictsCharted.Should().Be(1);

        await using (var scope = m.W.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            var day = UbDays.DayOf(m.W.F.Clock.UtcNow.AddDays(-1));
            dbx.Add(new Festival { Id = Guid.CreateVersion7(), Key = FestivalKeys.Naadam, Starts = day.AddDays(-1), Ends = day.AddDays(1) });
            await dbx.SaveChangesAsync();
        }
        (await m.Saruul.C.HonoursAsync()).Single(h => h.Key == HonourKeys.Naadam).Earned.Should().BeTrue();
        (await m.Bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.Naadam).Earned.Should().BeTrue();
    }

    [Fact]
    public async Task A_kept_encounter_charts_its_district_and_during_naadam_earns_that_years_honour()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.AskedAsync();
        await using (var scope = m.W.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            var day = UbDays.DayOf(m.W.F.Clock.UtcNow.AddDays(-1));
            dbx.Add(new Festival { Id = Guid.CreateVersion7(), Key = FestivalKeys.Naadam, Starts = day.AddDays(-1), Ends = day.AddDays(1) });
            await dbx.SaveChangesAsync();
        }
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();

        var log = (await m.Bat.C.GetFromJsonAsync<EncounterLogView>("/me/encounter-log"))!;
        log.Standing.Should().BeEquivalentTo(new StandingView(1, 1, 0, 0, ["Bayangol"]));
        log.Encounters.Should().ContainSingle().Which.Should().Match<EncounterLogRow>(r =>
            r.Name == "Saruul" && r.Venue == "Nomad Café" && r.Outcome == "kept" && r.Charted == "Bayangol");

        var hs = await m.Saruul.C.HonoursAsync();
        hs.Single(h => h.Key == HonourKeys.Naadam).Should().Match<HonourView>(h => h.Earned && h.Times == 1);
        hs.Single(h => h.Key == HonourKeys.FirstPledge).Earned.Should().BeTrue();
        hs.Single(h => h.Key == HonourKeys.TsagaanSar).Earned.Should().BeFalse();
    }

    [Fact]
    public async Task The_hall_carves_the_top_of_your_cohort_and_lights_your_torch()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male", city: "Bayangol");
        var saruul = await w.PersonAsync("Saruul", "Female", city: "Khan-Uul");
        var far = await w.PersonAsync("Dorj", "Male", city: "Tsetserleg");
        (await far.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();

        var hall = (await bat.C.GetFromJsonAsync<HallView>("/hall"))!;
        hall.Cohort.Should().Be("Ulaanbaatar");
        hall.Top.Should().HaveCount(2, "Tsetserleg is Arkhangai's hall");
        hall.Top[0].Points.Should().BeGreaterThan(hall.Top[1].Points);
        hall.You!.Rank.Should().Be(2);
        (await far.C.GetFromJsonAsync<HallView>("/hall"))!.Cohort.Should().Be("Arkhangai");
    }

    private static async Task<QuestBoard> Board(HttpClient c) => (await c.GetFromJsonAsync<QuestBoard>("/me/quests"))!;
}
