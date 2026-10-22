using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Safety;

/// Someone who makes a new character to trouble people: a removed number stays out, their device is
/// noticed, enough reports hide them before a keeper looks, and a new character has few summons.
public class TrollTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static Task<HttpResponseMessage> Start(World w, string phone) =>
        w.F.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, null));

    [Fact]
    public async Task A_removed_characters_number_gets_no_code_until_a_keeper_lifts_the_bar()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var admin = await w.F.AdminAsync();
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/suspend", new KeeperReason("Threatened people"))).EnsureSuccessStatusCode();
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/delete", new KeeperReason("Removed"))).EnsureSuccessStatusCode();

        var texts = w.Vm.SendCalls;
        var r = await Start(w, phone);
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodeOf(r)).Should().Be("auth.barred");
        w.Vm.SendCalls.Should().Be(texts, "no text goes to a barred number");
        (await admin.GetFromJsonAsync<List<AdminBarredRow>>("/admin/barred"))!
            .Should().ContainSingle(b => b.Phone == phone && b.Why == "Threatened people");

        (await admin.PostAsJsonAsync($"/admin/barred/{phone}/lift", new KeeperReason("Appealed"))).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await Start(w, phone)).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!.First()
            .Should().Match<AuditRow>(a => a.Action == "Lifted the bar on a number" && a.Target == phone && a.Note == "Appealed");
        (await admin.GetFromJsonAsync<List<AdminBarredRow>>("/admin/barred"))!.Should().NotContain(b => b.Phone == phone);
        (await CodeOf(await admin.PostAsJsonAsync($"/admin/barred/{phone}/lift", new KeeperReason("Again")))).Should().Be("admin.not_barred");
    }

    [Fact]
    public async Task Leaving_with_reports_open_bars_the_number_and_an_innocent_deletion_does_not()
    {
        await using var w = await World.CreateAsync(db);
        var (troll, honest) = (SessionDriver.NewPhone(), SessionDriver.NewPhone());
        var bat = await w.PersonAsync("Bat", "Male", phone: troll);
        var temuujin = await w.PersonAsync("Temuujin", "Male", phone: honest);
        var saruul = await w.PersonAsync("Saruul", "Female");
        (await saruul.C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "rude", null))).EnsureSuccessStatusCode();

        (await bat.C.PostAsync("/me/abandon", null)).EnsureSuccessStatusCode();
        var admin = await w.F.AdminAsync();
        (await admin.PostAsJsonAsync($"/admin/users/{temuujin.Id}/delete", new KeeperReason("Legal request"))).EnsureSuccessStatusCode();
        w.F.Clock.Advance(TimeSpan.FromDays(31));
        await w.F.DailySweepAsync();

        (await CodeOf(await Start(w, troll))).Should().Be("auth.barred");
        (await Start(w, honest)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_new_character_on_a_removed_or_suspended_characters_device_is_flagged_for_the_keepers()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male", deviceKey: "android-1");
        var dorj = await w.PersonAsync("Dorj", "Male", deviceKey: "android-2");
        var admin = await w.F.AdminAsync();
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/suspend", new KeeperReason("Troll"))).EnsureSuccessStatusCode();
        (await admin.PostAsJsonAsync($"/admin/users/{bat.Id}/delete", new KeeperReason("Removed"))).EnsureSuccessStatusCode();
        (await admin.PostAsJsonAsync($"/admin/users/{dorj.Id}/suspend", new KeeperReason("Troll"))).EnsureSuccessStatusCode();

        var again = await w.PersonAsync("Bold", "Male", deviceKey: "android-1");
        var twin = await w.PersonAsync("Ganaa", "Male", deviceKey: "android-2");
        var clean = await w.PersonAsync("Tsetseg", "Female", deviceKey: "android-3");
        var a = (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{again.Id}"))!;
        a.FlaggedWhy.Should().Be("Signed in on a device a removed character used");
        (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{twin.Id}"))!.FlaggedWhy
            .Should().Be("Signed in on a device a suspended character uses");
        (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{clean.Id}"))!.FlaggedAt.Should().BeNull();
        (await admin.GetFromJsonAsync<AdminUserPage>("/admin/users"))!.Items
            .Where(r => r.Flagged).Select(r => r.AccountId).Should().BeEquivalentTo([again.Id, twin.Id]);
        (await again.C.MeAsync()).Status.Should().Be("Active", "a shared phone is only noticed, never refused");

        var cleared = await admin.PostAsJsonAsync($"/admin/users/{again.Id}/clear-flag", new KeeperReason("Bought the phone used"));
        (await cleared.Content.ReadFromJsonAsync<AdminUserDetail>())!.FlaggedAt.Should().BeNull();
    }

    [Fact]
    public async Task Reports_from_three_people_hide_someone_from_Seek_until_a_keeper_decides()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var women = new List<World.Person>();
        for (var i = 0; i < 3; i++) women.Add(await w.PersonAsync($"W{i}", "Female"));
        var saruul = await w.PersonAsync("Saruul", "Female");
        (await saruul.C.SeekAsync()).Candidate!.AccountId.Should().Be(bat.Id);

        // Two people, or one person twice, are not enough.
        (await women[0].C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "rude", null))).EnsureSuccessStatusCode();
        (await women[0].C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "money", null))).EnsureSuccessStatusCode();
        (await women[1].C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "rude", null))).EnsureSuccessStatusCode();
        (await saruul.C.SeekAsync()).Candidate!.AccountId.Should().Be(bat.Id);

        (await women[2].C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "notWhoTheyClaim", null))).EnsureSuccessStatusCode();
        (await saruul.C.SeekAsync()).Candidate.Should().BeNull();
        (await CodeOf(await saruul.C.SummonRawAsync(bat.Id))).Should().Be("seek.gone");
        var admin = await w.F.AdminAsync();
        (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{bat.Id}"))!.UnderReview.Should().BeTrue();

        var last = (await admin.GetFromJsonAsync<AdminReportPage>("/admin/reports?status=Open"))!.Items
            .First(r => r.ReporterId == women[2].Id);
        (await admin.GetFromJsonAsync<AdminReportDetail>($"/admin/reports/{last.Id}"))!.TargetUnderReview.Should().BeTrue();
        (await admin.PostAsJsonAsync($"/admin/reports/{last.Id}/resolve", new ResolveReportRequest("dismiss", null))).EnsureSuccessStatusCode();
        (await saruul.C.SeekAsync()).Candidate!.AccountId.Should().Be(bat.Id, "dismissed, two reporters remain");
    }

    [Fact]
    public async Task A_new_character_has_three_summons_a_night_for_its_first_two_days()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        (await bat.C.SeekAsync()).CandlesPerDay.Should().Be(3);
        await w.AdvanceAsync(TimeSpan.FromDays(2) + TimeSpan.FromMinutes(1));
        (await bat.C.SeekAsync()).CandlesPerDay.Should().BeGreaterThan(3);
    }
}
