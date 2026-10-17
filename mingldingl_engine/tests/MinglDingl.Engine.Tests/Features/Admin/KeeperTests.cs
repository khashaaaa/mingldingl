using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Admin;

public class KeeperTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task A_codex_page_starts_in_both_languages_and_a_keepers_mongolian_replaces_the_first()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var pages = (await admin.GetFromJsonAsync<List<AdminCodexRow>>("/admin/codex"))!;
        pages.Should().NotBeEmpty().And.OnlyContain(p => p.Status == "published", "the first pages are seeded in both languages");
        var slug = pages[0].Slug;
        var reader = w.F.Client();
        (await reader.GetFromJsonAsync<CodexPageView>($"/codex/{slug}?locale=mn"))!.Title.Should().MatchRegex("[А-Яа-яӨөҮү]");

        (await admin.PutAsJsonAsync($"/admin/codex/{slug}", new CodexWriteRequest("mn", "Гал ба хүйтэн", "Товч", "Бие"))).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<List<AdminCodexRow>>("/admin/codex"))!.Single(p => p.Slug == slug).Status.Should().Be("published");
        (await reader.GetFromJsonAsync<CodexPageView>($"/codex/{slug}?locale=mn"))!.Title.Should().Be("Гал ба хүйтэн");
        (await reader.GetFromJsonAsync<CodexPageView>($"/codex/{slug}?locale=en"))!.Title.Should().NotBe("Гал ба хүйтэн");
    }

    [Fact]
    public async Task Every_keeper_write_is_written_in_the_audit_log_and_reads_are_not()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        var before = (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!.Count;
        (await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.CandlesBase}", new ConfigWriteRequest("6"))).EnsureSuccessStatusCode();
        await admin.GetAsync("/admin/users");
        (await admin.PostAsync("/admin/live/negotiate?negotiateVersion=1", null)).EnsureSuccessStatusCode();
        var fest = (await admin.GetFromJsonAsync<List<FestivalRow>>("/admin/festivals"))!.First(f => f.Key == FestivalKeys.TsagaanSar);
        (await admin.PutAsJsonAsync($"/admin/festivals/{fest.Id}", new FestivalWriteRequest(fest.Key, fest.Starts.AddDays(1), fest.Ends.AddDays(1))))
            .EnsureSuccessStatusCode();
        (await admin.PutAsJsonAsync($"/admin/festivals/{fest.Id}", new FestivalWriteRequest(fest.Key, fest.Ends, fest.Starts)))
            .IsSuccessStatusCode.Should().BeFalse("a festival cannot end before it starts");

        var log = (await admin.GetFromJsonAsync<List<AuditRow>>("/admin/audit"))!;
        log.Should().HaveCount(before + 2, "the refused write, the read and the live handshake are not written");
        log.Select(l => l.Action).Should().Contain($"Config changed: {ConfigKeys.CandlesBase} 5 → 6", string.Join(" | ", log.Select(l => l.Action)));
        log[0].Action.Should().Be("Festival calendar changed");
        (await admin.GetFromJsonAsync<List<FestivalRow>>("/admin/festivals"))!.Single(f => f.Id == fest.Id).Starts.Should().Be(fest.Starts.AddDays(1));
    }
}
