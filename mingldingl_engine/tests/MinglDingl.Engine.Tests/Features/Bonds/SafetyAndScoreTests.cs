using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Bonds;

public class SafetyAndScoreTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Casting_out_severs_the_bond_and_hides_both_ways_for_good()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);

        (await saruul.C.PostAsync($"/blocks/{bat.Id}", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Severed");
        var gate = await saruul.C.GetFromJsonAsync<List<BlockedView>>("/blocks");
        gate!.Should().ContainSingle(x => x.AccountId == bat.Id && x.Portrait!.Url == null);

        var other = await w.PersonAsync("Temuujin", "Male");
        (await saruul.C.SeekAsync()).Candidate?.AccountId.Should().Be(other.Id);
        (await saruul.C.DeleteAsync($"/blocks/{bat.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await saruul.C.GetFromJsonAsync<List<BlockedView>>("/blocks"))!.Should().BeEmpty();
        (await CodeOf(await bat.C.SummonRawAsync(saruul.Id))).Should().Be("seek.gone", "let in, but a pair never bonds twice");
    }

    [Fact]
    public async Task A_report_changes_nothing_until_an_admin_penalises()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id, "Send me 50,000₮ for a taxi");
        var before = await bat.C.PointsAsync();

        var r = await saruul.C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, bond.Id, "money", "They asked for taxi money."));
        r.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await CodeOf(await saruul.C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, null, "bribery", null))))
            .Should().Be("report.reason");
        (await bat.C.PointsAsync()).Should().Be(before);

        var admin = await w.F.AdminAsync();
        var page = await admin.GetFromJsonAsync<AdminReportPage>("/admin/reports?status=Open");
        var row = page!.Items.Single();
        row.TargetName.Should().Be("Bat");
        row.Note.Should().Be("They asked for taxi money.");
        var detail = await admin.GetFromJsonAsync<AdminReportDetail>($"/admin/reports/{row.Id}");
        detail!.LastLetters.Should().ContainSingle(l => l.ByTarget && l.Text.Contains("taxi"));

        var resolved = await admin.PostAsJsonAsync($"/admin/reports/{row.Id}/resolve", new ResolveReportRequest("penalise", "Asked for money"));
        resolved.EnsureSuccessStatusCode();
        (await bat.C.PointsAsync()).Should().Be(before - 30);
        var again = await admin.PostAsJsonAsync($"/admin/reports/{row.Id}/resolve", new ResolveReportRequest("penalise", null));
        (await again.Content.ReadFromJsonAsync<ErrorBody>())!.Code.Should().Be("admin.report_resolved");
        (await bat.C.GetFromJsonAsync<DeedPage>("/me/deeds"))!.Items[0].Should().Match<DeedView>(d => d.Kind == "penalised" && d.Amount == -30);

        var record = (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{bat.Id}"))!;
        record.Reputation.Should().Be(90);
        record.ReportsAgainst.Should().Be(1);
        record.Deeds[0].Kind.Should().Be("penalised");
        record.Bonds.Should().ContainSingle(b => b.Id == bond.Id && b.OtherName == "Saruul" && b.State == "Live" && b.Letters == 1);
    }

    [Fact]
    public async Task Casting_out_an_account_suspends_it_and_severs_its_bonds()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await saruul.C.PostAsJsonAsync("/reports", new ReportRequest(bat.Id, bond.Id, "under18", null));
        var admin = await w.F.AdminAsync();
        var id = (await admin.GetFromJsonAsync<AdminReportPage>("/admin/reports"))!.Items.Single().Id;
        (await admin.PostAsJsonAsync($"/admin/reports/{id}/resolve", new ResolveReportRequest("castOut", null))).EnsureSuccessStatusCode();
        (await bat.C.MeAsync()).Status.Should().Be("Suspended");
        (await saruul.C.BondAsync(bond.Id)).State.Should().Be("Severed");
        (await CodeOf(await bat.C.WriteRawAsync(bond.Id, "hi"))).Should().Be("account.suspended");
    }

    [Fact]
    public async Task Finishing_pays_once_and_Opal_still_takes_doing()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var me = (await bat.C.MeAsync()).Profile!;
        me.Points.Should().Be(50);
        me.Tier.Should().Be("Garnet", "finishing alone does not reach the first gem");
        me.TierUpPending.Should().BeNull();
        (await bat.C.UpdateAsync(ProfileDriver.Upd(welcomed: true))).EnsureSuccessStatusCode();
        (await bat.C.PointsAsync()).Should().Be(50, "paid once");

        // Some doing on top of it lifts the character to Opal, with one ceremony.
        await w.SetAsync(ConfigKeys.ScoreFinished, "100");
        var dee = await w.PersonAsync("Dee", "Female");
        var her = (await dee.C.MeAsync()).Profile!;
        her.Tier.Should().Be("Opal");
        her.TierUpPending.Should().Be("Opal");
        (await dee.C.PostAsync("/me/tier-up/seen", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await dee.C.MeAsync()).Profile!.TierUpPending.Should().BeNull();
        var ladder = await bat.C.GetFromJsonAsync<List<TierView>>("/tiers");
        ladder!.Select(t => t.Points).Should().Equal(0, 100, 300, 600, 1000, 2000);
    }

    [Fact]
    public async Task Each_new_dawn_pays_by_streak_and_the_seventh_pays_the_bonus()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var paid = new List<int>();
        for (var day = 0; day < 7; day++)
        {
            var first = await (await bat.C.PostAsync("/me/dawn", null)).Content.ReadFromJsonAsync<DawnView>();
            var second = await (await bat.C.PostAsync("/me/dawn", null)).Content.ReadFromJsonAsync<DawnView>();
            second!.Earned.Should().Be(0, "once a day");
            paid.Add(first!.Earned);
            await w.AdvanceAsync(TimeSpan.FromDays(1));
        }
        paid.Should().Equal(5, 10, 15, 20, 25, 30, 35 + 50);
        await w.AdvanceAsync(TimeSpan.FromDays(1)); // a missed day
        var back = await (await bat.C.PostAsync("/me/dawn", null)).Content.ReadFromJsonAsync<DawnView>();
        back!.Streak.Should().Be(1);
        back.Earned.Should().Be(5);
    }

    [Fact]
    public async Task Tier_and_seal_ladders_stay_strictly_increasing()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var bad = await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.TierAmethyst}", new MinglDingl.Engine.Features.Admin.ConfigWriteRequest("100"));
        (await bad.Content.ReadFromJsonAsync<ErrorBody>())!.Code.Should().Be("config.out_of_bounds");
        var bad2 = await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.Seal2}", new MinglDingl.Engine.Features.Admin.ConfigWriteRequest("40"));
        (await bad2.Content.ReadFromJsonAsync<ErrorBody>())!.Code.Should().Be("config.out_of_bounds");
        var ok = await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.Seal2}", new MinglDingl.Engine.Features.Admin.ConfigWriteRequest("12"));
        ok.EnsureSuccessStatusCode();
    }
}
