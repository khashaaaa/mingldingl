using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Stats;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Admin;

public class AdminHandTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<AdminUserDetail> Act(HttpClient admin, Guid id, string path, object body)
    {
        var r = await admin.PostAsJsonAsync($"/admin/users/{id}/{path}", body);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<AdminUserDetail>())!;
    }

    [Fact]
    public async Task Suspend_and_lift_keep_the_reason_and_write_it_in_the_audit_log()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        var admin = await w.F.AdminAsync();

        var s = await Act(admin, bat.Id, "suspend", new KeeperReason("Asked three people for money"));
        (s.Status, s.SuspendedWhy).Should().Be(("Suspended", "Asked three people for money"));
        (await saruul.C.BondAsync(bond.Id)).State.Should().Be("Severed");
        (await CodeOf(await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/suspend", new KeeperReason("again")))).Should().Be("admin.already_suspended");
        var row = (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!.First();
        (row.Action, row.Target, row.Note).Should().Be(("Suspended", "Bat", "Asked three people for money"));

        var l = await Act(admin, bat.Id, "lift", new KeeperReason("Appeal heard"));
        (l.Status, l.SuspendedAt).Should().Be(("Active", null));
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/suspend", new KeeperReason(""))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Clearing_a_tale_sends_them_back_to_write_one_and_a_removed_portrait_below_the_minimum_asks_for_another()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var admin = await w.F.AdminAsync();
        var named = await Act(admin, bat.Id, "clear", new KeeperClearRequest("name", "Slur in the name"));
        named.Profile!.Name.Should().Be(AdminHand.ClearedName);
        (await Act(admin, bat.Id, "clear", new KeeperClearRequest("tale", "A phone number in the tale"))).OnboardingStep.Should().Be(4);
        var photo = named.Photos[0].Id;
        (await Act(admin, bat.Id, $"photos/{photo}/remove", new KeeperReason("Not a portrait"))).OnboardingStep.Should().Be(3);
        (await CodeOf(await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/clear", new KeeperClearRequest("city", "x")))).Should().Be("admin.bad_field");
    }

    [Fact]
    public async Task A_given_floor_shows_as_the_keepers_and_a_score_adjustment_moves_points_and_reputation_within_bounds()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var admin = await w.F.AdminAsync();
        await Act(admin, bat.Id, "floor", new KeeperFloorRequest("hall", 30, "Play closed-test tester"));
        var m = (await bat.C.GetFromJsonAsync<MinglDingl.Engine.Features.Payments.GuildMe>("/me/membership"))!.Membership;
        (m.Floor, m.Source, m.Renews).Should().Be(("hall", "keeper", false));

        var before = await bat.C.PointsAsync();
        var d = await Act(admin, bat.Id, "adjust", new KeeperAdjustRequest(30, 50, "Penalty was a mistake"));
        (await bat.C.PointsAsync()).Should().Be(before + 30);
        d.Reputation.Should().Be(100, "reputation never passes 100");
        (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!.First().Action.Should().Be("Adjusted score +30 points, +50 reputation");
    }

    [Fact]
    public async Task Delete_now_burns_the_account_at_once()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var admin = await w.F.AdminAsync();
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/delete", new KeeperReason("Legal request"))).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await admin.GetAsync($"/admin/users/{bat.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var row = (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!.First();
        (row.Action, row.Target, row.Note).Should().Be(("Deleted at once", "Bat", "Legal request"));
    }

    [Fact]
    public async Task The_often_severed_table_names_whom_each_row_is()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        for (var i = 0; i < 3; i++)
        {
            var her = await w.PersonAsync($"W{i}", "Female");
            var bond = await bat.C.SummonAsync(her.Id);
            (await her.C.PostAsync($"/bonds/{bond.Id}/sever", null)).EnsureSuccessStatusCode();
        }
        var admin = await w.F.AdminAsync();
        var today = w.F.Clock.TodayUb;
        var t = (await admin.GetFromJsonAsync<StatTable>($"/admin/stats/tables/severed?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"))!;
        t.People.Should().Equal(bat.Id);
    }
}
