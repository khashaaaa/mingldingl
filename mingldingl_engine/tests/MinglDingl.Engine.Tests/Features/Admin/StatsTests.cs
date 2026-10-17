using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Stats;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Admin;

public class StatsTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Finished_days_are_rolled_up_today_is_counted_live_and_filters_narrow()
    {
        await using var w = await World.CreateAsync(db);
        var day1 = w.F.Clock.TodayUb;
        var bat = await w.PersonAsync("Bat", "Male");
        await w.PersonAsync("Anu", "Female");
        await bat.C.SummonAsync((await bat.C.SeekAsync()).Candidate!.AccountId);

        await w.AdvanceAsync(TimeSpan.FromDays(1));
        await w.PersonAsync("Saraa", "Female");
        await w.F.Services.GetRequiredService<StatsSweep>().RunAsync();

        var admin = await w.F.AdminAsync();
        var day2 = w.F.Clock.TodayUb;
        var all = (await admin.GetFromJsonAsync<StatsView>($"/admin/stats?metrics=signups,bonds,finished&from={day1:yyyy-MM-dd}&to={day2:yyyy-MM-dd}"))!;
        var signups = all.Series.Single(s => s.Metric == "signups");
        signups.Days.Select(d => d.Count).Should().Equal(2, 1);
        signups.Count.Should().Be(3);
        all.Series.Single(s => s.Metric == "bonds").Count.Should().Be(1);

        var women = (await admin.GetFromJsonAsync<StatsView>($"/admin/stats?metrics=finished&from={day1:yyyy-MM-dd}&to={day2:yyyy-MM-dd}&gender=Female"))!;
        women.Series.Single().Days.Select(d => d.Count).Should().Equal(new long[] { 1, 1 }, "rolled-up and live days filter alike");

        // A day rolled up twice is counted once.
        await w.F.Services.GetRequiredService<StatsSweep>().RunAsync();
        (await admin.GetFromJsonAsync<StatsView>($"/admin/stats?metrics=signups&from={day1:yyyy-MM-dd}&to={day1:yyyy-MM-dd}"))!
            .Series.Single().Count.Should().Be(2);

        (await CodeOf(await admin.GetAsync($"/admin/stats?metrics=nope&from={day1:yyyy-MM-dd}&to={day2:yyyy-MM-dd}"))).Should().Be("stats.metric");
        (await (await w.F.Client().GetAsync($"/admin/stats?metrics=signups&from={day1:yyyy-MM-dd}&to={day2:yyyy-MM-dd}")).Content.ReadAsStringAsync())
            .Should().BeEmpty("keepers only");
    }

    [Fact]
    public async Task Each_group_has_its_table_and_the_dashboard_counts_today()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        await w.PersonAsync("Anu", "Female");
        (await bat.C.PostAsync("/me/dawn", null)).EnsureSuccessStatusCode();
        await bat.C.SummonAsync((await bat.C.SeekAsync()).Candidate!.AccountId);
        var admin = await w.F.AdminAsync();
        var today = w.F.Clock.TodayUb;

        foreach (var group in new[] { "growth", "engagement", "matching", "encounters", "square", "money", "cohorts" })
        {
            var r = await admin.GetAsync($"/admin/stats/tables/{group}?from={today.AddDays(-30):yyyy-MM-dd}&to={today:yyyy-MM-dd}");
            r.EnsureSuccessStatusCode();
        }
        var funnel = (await admin.GetFromJsonAsync<StatTable>($"/admin/stats/tables/growth?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"))!;
        funnel.Rows.Last().Should().Equal("In the world", "2", "—", "100%");
        var sources = (await admin.GetFromJsonAsync<StatTable>($"/admin/stats/tables/matching?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"))!;
        sources.Rows.Single()[0].Should().Be("Seek");

        var dash = (await admin.GetFromJsonAsync<DashboardView>("/admin/dashboard"))!;
        dash.ActiveToday.Should().Be(1);
        dash.BondsToday.Should().Be(1);

        (await bat.C.PostAsync("/me/abandon", null)).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<List<DeletionRow>>("/admin/deletions"))!.Single().Name.Should().Be("Bat");
        var health = (await admin.GetFromJsonAsync<HealthView>("/admin/health"))!;
        health.DatabaseBytes.Should().BePositive();
        health.Checks.Should().HaveCount(4);
    }
}
