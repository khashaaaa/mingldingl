using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Bonds;

public class AwayTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Away_by_the_fire_holds_every_fire_and_the_silence_counts_again_from_the_return()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id, "hello");
        var start = await saruul.C.PointsAsync();

        var me = await (await saruul.C.PostAsJsonAsync("/me/away", new AwayRequest(3))).Read<MeView>();
        me.Profile!.AwayUntil.Should().BeCloseTo(w.F.Clock.Now.AddDays(3), TimeSpan.FromSeconds(5));
        me.Profile.AwayNextAt.Should().NotBeNull("once in thirty days");
        var seen = await bat.C.BondAsync(bond.Id);
        seen.Other.AwayUntil.Should().NotBeNull();

        await w.AdvanceAsync(TimeSpan.FromHours(60));
        await w.SweepAsync();
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Live", "nothing goes cold while she is away");

        await w.AdvanceAsync(TimeSpan.FromHours(13)); // back after 72 hours
        (await bat.C.BondAsync(bond.Id)).Other.AwayUntil.Should().BeNull();
        await w.AdvanceAsync(TimeSpan.FromHours(40));
        await w.SweepAsync();
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Live", "the 48 hours count from her return");
        await w.AdvanceAsync(TimeSpan.FromHours(9));
        await w.SweepAsync();
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Cold");
        (await saruul.C.PointsAsync()).Should().BeLessThan(start);
    }

    [Fact]
    public async Task Away_hides_them_from_Seek_once_a_moon_and_a_letter_brings_them_back()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var oyun = await w.PersonAsync("Oyun", "Female");
        await bat.C.SummonAsync(oyun.Id);

        (await CodeOf(await saruul.C.PostAsJsonAsync("/me/away", new AwayRequest(8)))).Should().Be("away.days");
        (await saruul.C.PostAsJsonAsync("/me/away", new AwayRequest(1))).EnsureSuccessStatusCode();
        (await bat.C.SeekAsync()).State.Should().Be("empty", "she is away by the fire");
        (await CodeOf(await saruul.C.PostAsJsonAsync("/me/away", new AwayRequest(1)))).Should().Be("away.already");

        (await saruul.C.DeleteAsync("/me/away")).EnsureSuccessStatusCode();
        (await saruul.C.MeAsync()).Profile!.AwayUntil.Should().BeNull();
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(saruul.Id);
        (await CodeOf(await saruul.C.PostAsJsonAsync("/me/away", new AwayRequest(1)))).Should().Be("away.too_soon");

        await w.AdvanceAsync(TimeSpan.FromDays(31));
        (await saruul.C.MeAsync()).Profile!.AwayNextAt.Should().BeNull("a moon has passed");
        var anu = await w.PersonAsync("Anu", "Female");
        var bond = await bat.C.SummonAsync(anu.Id);
        (await bat.C.PostAsJsonAsync("/me/away", new AwayRequest(7))).EnsureSuccessStatusCode();
        await bat.C.WriteAsync(bond.Id, "back already");
        (await bat.C.MeAsync()).Profile!.AwayUntil.Should().BeNull("a letter brings them back");
    }

    [Fact]
    public async Task The_three_new_guides_are_in_the_Codex_in_both_languages()
    {
        await using var w = await World.CreateAsync(db);
        var reader = w.F.Client();
        foreach (var slug in new[] { "first-letter", "before-you-meet", "letting-go" })
        {
            (await reader.GetFromJsonAsync<CodexPageView>($"/codex/{slug}?locale=en"))!.Body.Should().NotBeEmpty();
            (await reader.GetFromJsonAsync<CodexPageView>($"/codex/{slug}?locale=mn"))!.Title.Should().MatchRegex("[А-Яа-яӨөҮү]");
        }
    }
}
