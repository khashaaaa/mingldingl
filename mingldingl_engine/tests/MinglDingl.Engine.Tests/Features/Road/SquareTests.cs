using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Square;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Road;

public class SquareTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<AdminGatheringRow> Ring(World w, HttpClient admin, int seats = 4, int rounds = 2, int inMinutes = 5) =>
        await (await admin.PostAsJsonAsync("/admin/gatherings",
            new GatheringWriteRequest("The Fourth Bell", w.F.Clock.UtcNow.AddMinutes(inMinutes), rounds, 1, seats, null, false)))
            .Read<AdminGatheringRow>();

    private static async Task Tick(World w)
    {
        await w.F.Services.GetRequiredService<SquareClock>().RunAsync();
    }

    private static async Task<NightView> Night(HttpClient c, Guid id) => (await c.GetFromJsonAsync<NightView>($"/square/{id}/night"))!;

    [Fact]
    public async Task Each_side_holds_half_the_seats_and_a_seat_can_be_given_up_before_the_bell()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var g = await Ring(w, admin, seats: 2);
        var bat = await w.PersonAsync("Bat", "Male");
        var dorj = await w.PersonAsync("Dorj", "Male");
        var anu = await w.PersonAsync("Anu", "Female");

        var tab = (await bat.C.GetFromJsonAsync<SquareView>("/square"))!.Next!;
        tab.Should().Match<GatheringView>(v => v.Id == g.Id && v.State == "open" && v.SideSeats == 1 && !v.Seated);
        (await bat.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        (await CodeOf(await dorj.C.PostAsync($"/square/{g.Id}/seat", null))).Should().Be("square.full");
        (await anu.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        (await bat.C.DeleteAsync($"/square/{g.Id}/seat")).EnsureSuccessStatusCode();
        (await dorj.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<List<AdminGatheringRow>>("/admin/gatherings"))!.Single().Taken.Should().Be(2);
    }

    [Fact]
    public async Task A_night_pairs_a_man_and_a_woman_two_yeses_make_a_bond_and_they_never_meet_twice()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var g = await Ring(w, admin, inMinutes: 15);
        var bat = await w.PersonAsync("Bat", "Male");
        var anu = await w.PersonAsync("Anu", "Female");
        foreach (var p in new[] { bat, anu }) (await p.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        (await CodeOf(await bat.C.PostAsync($"/square/{g.Id}/join", null))).Should().Be("square.not_yet", "the doors open ten minutes before");

        await w.AdvanceAsync(TimeSpan.FromMinutes(11));
        foreach (var p in new[] { bat, anu }) (await p.C.PostAsync($"/square/{g.Id}/join", null)).EnsureSuccessStatusCode();
        (await Night(bat.C, g.Id)).Phase.Should().Be("filling");

        await w.AdvanceAsync(TimeSpan.FromMinutes(4));
        await Tick(w);
        var live = await Night(bat.C, g.Id);
        live.Should().Match<NightView>(n => n.Phase == "live" && n.Round == 1 && n.Partner!.Name == "Anu" && n.Question != null);

        (await CodeOf(await bat.C.PostAsJsonAsync($"/square/{g.Id}/decide", new DecideRequest(true)))).Should().Be("square.no_bell");
        await w.AdvanceAsync(TimeSpan.FromSeconds(61));
        (await Night(anu.C, g.Id)).Phase.Should().Be("bell");
        var before = await bat.C.PointsAsync();
        (await bat.C.PostAsJsonAsync($"/square/{g.Id}/decide", new DecideRequest(true))).EnsureSuccessStatusCode();
        (await Night(bat.C, g.Id)).Phase.Should().Be("decided");
        var done = await (await anu.C.PostAsJsonAsync($"/square/{g.Id}/decide", new DecideRequest(true))).Read<NightView>();
        done.Should().Match<NightView>(n => n.Phase == "result" && n.Outcome == "match" && n.BondId != null && n.BondsTonight == 1);

        var bond = await bat.C.BondAsync(done.BondId!.Value);
        bond.SummonedByMe.Should().BeFalse();
        (await bat.C.PointsAsync()).Should().Be(before + 10, "a round at the square pays once");
        (await bat.C.GetFromJsonAsync<List<HonourView>>("/me/honours"))!.Single(h => h.Key == HonourKeys.FateSeer).Earned.Should().BeTrue();

        // Round two: the only pair already met, so both sit it out; then the square closes.
        await w.AdvanceAsync(TimeSpan.FromSeconds(60));
        await Tick(w);
        (await Night(bat.C, g.Id)).Should().Match<NightView>(n => n.Phase == "filling" && n.Round == 2);
        await w.AdvanceAsync(TimeSpan.FromMinutes(2));
        await Tick(w);
        (await Night(anu.C, g.Id)).Should().Match<NightView>(n => n.Phase == "closed" && n.BondsTonight == 1);
        (await bat.C.GetFromJsonAsync<DeedPage>("/me/deeds"))!.Items.Count(d => d.Kind == DeedKinds.Square).Should().Be(1);
    }

    [Fact]
    public async Task Silence_at_the_bell_parts_them_and_leaving_gives_up_the_night()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var g = await Ring(w, admin);
        var bat = await w.PersonAsync("Bat", "Male");
        var anu = await w.PersonAsync("Anu", "Female");
        foreach (var p in new[] { bat, anu }) (await p.C.PostAsync($"/square/{g.Id}/seat", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromMinutes(5));
        foreach (var p in new[] { bat, anu }) (await p.C.PostAsync($"/square/{g.Id}/join", null)).EnsureSuccessStatusCode();
        await Tick(w);
        await w.AdvanceAsync(TimeSpan.FromSeconds(61));
        (await bat.C.PostAsJsonAsync($"/square/{g.Id}/decide", new DecideRequest(true))).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromSeconds(31));
        await Tick(w);
        (await Night(bat.C, g.Id)).Should().Match<NightView>(n => n.Phase == "result" && n.Outcome == "apart" && n.BondId == null);
        (await bat.C.BondsAsync()).Should().BeEmpty();

        (await anu.C.PostAsync($"/square/{g.Id}/leave", null)).EnsureSuccessStatusCode();
        (await Night(anu.C, g.Id)).Phase.Should().Be("left");
        (await CodeOf(await anu.C.PostAsync($"/square/{g.Id}/join", null))).Should().Be("square.no_seat");
    }

    [Fact]
    public async Task A_keeper_edits_a_gathering_before_it_begins_but_not_after()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var g = await Ring(w, admin, inMinutes: 60);
        var later = w.F.Clock.UtcNow.AddHours(2);
        var edited = await (await admin.PutAsJsonAsync($"/admin/gatherings/{g.Id}",
            new GatheringWriteRequest("The Fifth Bell", later, 3, 5, 8, null, true))).Read<AdminGatheringRow>();
        edited.Name.Should().Be("The Fifth Bell");
        (await admin.GetFromJsonAsync<List<MinglDingl.Engine.Features.Admin.AuditRow>>("/admin/audit"))!.First().Action
            .Should().Be("A gathering was edited");
        await w.AdvanceAsync(TimeSpan.FromHours(3));
        (await CodeOf(await admin.PutAsJsonAsync($"/admin/gatherings/{g.Id}",
            new GatheringWriteRequest("Late", w.F.Clock.UtcNow.AddHours(1), 3, 5, 8, null, true)))).Should().Be("square.started");
    }
}
