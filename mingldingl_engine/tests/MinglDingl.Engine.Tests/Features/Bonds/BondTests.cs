using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Push;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Bonds;

public class BondTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Seek_offers_the_opposite_gender_and_prefers_the_same_district()
    {
        await using var w = await World.CreateAsync(db);
        var me = await w.PersonAsync("Bat", "Male", "Bayangol");
        var far = await w.PersonAsync("Oyun", "Female", "Darkhan");
        var near = await w.PersonAsync("Saruul", "Female", "Bayangol");
        await w.PersonAsync("Temuujin", "Male", "Bayangol");

        var seek = await me.C.SeekAsync();
        seek.State.Should().Be("companion");
        seek.Candidate!.AccountId.Should().Be(near.Id);
        seek.Candidate.Place.Should().Be("Ulaanbaatar", "the district is a seal's reward");
        seek.Candidate.Portrait!.Url.Should().BeNull("a candidate's portrait is only its ThumbHash");
        seek.Candidate.Portrait.ThumbHash.Should().NotBeEmpty();
        (await me.C.GetStringAsync("/seek")).Should().NotContain("\"name\"", "a stranger is nameless until a bond is made");

        (await me.C.PostAsync($"/seek/{near.Id}/pass", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await me.C.SeekAsync()).Candidate!.AccountId.Should().Be(far.Id);
    }

    [Fact]
    public async Task Summon_makes_the_bond_for_both_live_and_spends_a_candle()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        await using var hers = await w.F.ListenAsync(saruul.S);
        var before = (await bat.C.SeekAsync()).CandlesLeft;

        var bond = await bat.C.SummonAsync(saruul.Id);
        bond.State.Should().Be("Live");
        bond.SummonedByMe.Should().BeTrue();
        bond.Other.Name.Should().Be("Saruul");
        bond.Other.Portraits.Should().OnlyContain(p => p.Url == null, "every seal is intact");

        (await hers.WaitForAsync(LiveKinds.BondCreated)).Should().NotBeNull();
        (await w.Push.WaitForAsync(m => m.Data["kind"] == "bondMade")).Should().BeNull("Saruul registered no push token");
        (await saruul.C.BondsAsync()).Should().ContainSingle(r => r.Id == bond.Id && !r.MyTurn);
        var after = await bat.C.SeekAsync();
        after.CandlesLeft.Should().Be(before - 1);
        after.State.Should().Be("empty");
        (await CodeOf(await bat.C.SummonRawAsync(saruul.Id))).Should().Be("seek.gone", "a pair bonds once, ever");
    }

    [Fact]
    public async Task No_candles_left_means_the_realm_rests()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.ScoreFinished, "100"); // a finished character starts at Opal here
        await w.SetAsync(ConfigKeys.CandlesBase, "1");
        await w.SetAsync(ConfigKeys.CandlesCap, "1");
        var bat = await w.PersonAsync("Bat", "Male");
        var a = await w.PersonAsync("Saruul", "Female");
        var b = await w.PersonAsync("Oyun", "Female");
        // A finished character is Opal (tier 1): min(1 + 100/50 + 1, cap 1 + 1) = 2 candles.
        (await bat.C.SeekAsync()).CandlesPerDay.Should().Be(2);
        await bat.C.SummonAsync(a.Id);
        await bat.C.SummonAsync(b.Id);
        await w.PersonAsync("Anu", "Female");
        var rests = await bat.C.SeekAsync();
        rests.State.Should().Be("rests");
        rests.CandlesLeft.Should().Be(0);
        rests.NextDawnAt.Should().BeAfter(w.F.Clock.Now);
    }

    [Fact]
    public async Task A_full_fire_refuses_summons_and_a_closed_bond_frees_the_seat()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.ScoreFinished, "100"); // a finished character starts at Opal here
        await w.SetAsync(ConfigKeys.SeatsBase, "1");
        var bat = await w.PersonAsync("Bat", "Male");
        var a = await w.PersonAsync("Saruul", "Female");
        var b = await w.PersonAsync("Oyun", "Female");
        // Opal is tier 1: one base seat + one.
        var first = await bat.C.SummonAsync(a.Id);
        await bat.C.SummonAsync(b.Id);
        var c = await w.PersonAsync("Anu", "Female");
        (await bat.C.SeekAsync()).State.Should().Be("full");
        (await CodeOf(await bat.C.SummonRawAsync(c.Id))).Should().Be("seek.fire_full");

        (await bat.C.PostAsync($"/bonds/{first.Id}/sever", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await bat.C.SeekAsync()).State.Should().Be("companion");
    }

    [Fact]
    public async Task Concurrent_summons_never_overflow_the_fire()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.ScoreFinished, "100"); // a finished character starts at Opal here
        await w.SetAsync(ConfigKeys.SeatsBase, "1");
        var bat = await w.PersonAsync("Bat", "Male");
        var women = new List<World.Person>();
        for (var i = 0; i < 5; i++) women.Add(await w.PersonAsync($"W{i}", "Female"));
        var results = await Task.WhenAll(women.Select(x => bat.C.SummonRawAsync(x.Id)));
        results.Count(r => r.IsSuccessStatusCode).Should().Be(2, "Opal holds 1 + 1 seats");
        (await bat.C.BondsAsync()).Count(r => r.State == "Live").Should().Be(2);
    }

    [Fact]
    public async Task Letters_pay_points_and_turns_alternate()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        var batStart = await bat.C.PointsAsync();
        var herStart = await saruul.C.PointsAsync();

        await bat.C.WriteAsync(bond.Id, "The falcon came back at dusk");
        (await bat.C.PointsAsync()).Should().Be(batStart + 10, "the first letter of a bond");
        (await saruul.C.BondAsync(bond.Id)).MyTurn.Should().BeTrue();
        (await bat.C.BondAsync(bond.Id)).MyTurn.Should().BeFalse();
        (await saruul.C.BondsAsync()).Single().Unread.Should().BeTrue();

        await bat.C.WriteAsync(bond.Id, "Are you there?");
        (await bat.C.PointsAsync()).Should().Be(batStart + 10, "a second letter in a row is not a reply");

        await saruul.C.WriteAsync(bond.Id, "Then bring the map");
        (await saruul.C.PointsAsync()).Should().Be(herStart + 10, "a reply");
        var row = (await bat.C.BondsAsync()).Single();
        row.LastLetter.Should().Be("Then bring the map");
        row.MyTurn.Should().BeTrue();

        (await CodeOf(await bat.C.WriteRawAsync(bond.Id, "   "))).Should().Be("letter.empty");
        var page = await bat.C.GetFromJsonAsync<LetterPage>($"/bonds/{bond.Id}/letters");
        page!.Items.Select(l => l.Text).Should().Equal("Then bring the map", "Are you there?", "The falcon came back at dusk");
        page.Items[0].Mine.Should().BeFalse();
    }

    [Fact]
    public async Task Replies_pay_at_most_the_daily_cap_per_bond()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.ScoreReplyDailyCap, "2");
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id);
        var start = await saruul.C.PointsAsync();
        await ExchangeAsync(bond.Id, saruul.C, bat.C, 4);
        (await saruul.C.PointsAsync()).Should().Be(start + 20);
        await w.AdvanceAsync(TimeSpan.FromDays(1));
        await saruul.C.WriteAsync(bond.Id);
        (await saruul.C.PointsAsync()).Should().Be(start + 30, "a new Ulaanbaatar day pays again");
    }

    [Fact]
    public async Task Seals_break_on_letters_each_and_reveal_portraits_then_the_district()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male", "Bayangol");
        var saruul = await w.PersonAsync("Saruul", "Female", "Khan-Uul", photos: 4);
        var bond = await bat.C.SummonAsync(saruul.Id);
        await using var mine = await w.F.ListenAsync(bat.S);

        for (var i = 0; i < 8; i++) await bat.C.WriteAsync(bond.Id, $"m{i}");
        (await bat.C.BondAsync(bond.Id)).Seals.Should().Be(0, "a monologue breaks no seal");

        for (var i = 0; i < 5; i++) await saruul.C.WriteAsync(bond.Id, $"r{i}");
        var one = await bat.C.BondAsync(bond.Id);
        one.Seals.Should().Be(1);
        one.Other.Portraits.Count(p => p.Url != null).Should().Be(1);
        one.Other.Place.Should().Be("Ulaanbaatar");
        one.NextSealAt.Should().Be(10);
        var page = await bat.C.GetFromJsonAsync<LetterPage>($"/bonds/{bond.Id}/letters");
        page!.Items.Should().ContainSingle(l => l.SealBroken == 1);

        await ExchangeAsync(bond.Id, saruul.C, bat.C, 10);
        var three = await bat.C.BondAsync(bond.Id);
        three.Seals.Should().Be(3);
        three.Other.Portraits.Count(p => p.Url != null).Should().Be(3);
        three.Other.Place.Should().Be("Khan-Uul");

        await ExchangeAsync(bond.Id, saruul.C, bat.C, 15);
        var all = await bat.C.BondAsync(bond.Id);
        all.Seals.Should().Be(4);
        all.NextSealAt.Should().BeNull();
        all.Other.Portraits.Should().OnlyContain(p => p.Url != null);
        (await bat.C.BondsAsync()).Single().OtherPortrait!.Url.Should().NotBeNull();
    }

    [Fact]
    public async Task Silence_on_your_turn_warns_then_goes_cold_with_the_penalty()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        await saruul.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest("ExponentPushToken[saruul]"));
        await bat.C.PutAsJsonAsync("/me/push-token", new PushTokenRequest("ExponentPushToken[bat]"));
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id, "Are you still coming on Sunday?");
        (await w.Push.WaitForAsync(m => m.To == "ExponentPushToken[saruul]" && m.Data["kind"] == "letter"))!
            .Title.Should().Be("A letter from Bat");
        var herPoints = await saruul.C.PointsAsync();

        await w.AdvanceAsync(TimeSpan.FromHours(37));
        await w.SweepAsync();
        var warned = await saruul.C.BondAsync(bond.Id);
        warned.Embers.Should().BeTrue();
        warned.State.Should().Be("Live");
        (await w.Push.WaitForAsync(m => m.To == "ExponentPushToken[saruul]" && m.Data["kind"] == "embers"))!
            .Body.Should().Contain("12 hours");
        await w.SweepAsync();
        w.Push.Sent.Count(m => m.Data["kind"] == "embers").Should().Be(1, "warned once");

        await w.AdvanceAsync(TimeSpan.FromHours(12));
        await w.SweepAsync();
        var cold = await bat.C.BondAsync(bond.Id);
        cold.State.Should().Be("Cold");
        cold.ClosedByMe.Should().BeFalse();
        (await saruul.C.PointsAsync()).Should().Be(herPoints - 15);
        (await CodeOf(await saruul.C.WriteRawAsync(bond.Id, "sorry"))).Should().Be("bond.closed");
        (await w.Push.WaitForAsync(m => m.To == "ExponentPushToken[bat]" && m.Data["kind"] == "goneCold")).Should().NotBeNull();
    }

    [Fact]
    public async Task A_reply_puts_the_embers_out()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id);
        await w.AdvanceAsync(TimeSpan.FromHours(40));
        await w.SweepAsync();
        await saruul.C.WriteAsync(bond.Id, "Here!");
        (await bat.C.BondAsync(bond.Id)).Embers.Should().BeFalse();
        await w.AdvanceAsync(TimeSpan.FromHours(10));
        await w.SweepAsync();
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Live", "the clock restarted with her reply");
    }

    [Fact]
    public async Task A_bond_no_one_wrote_in_fades_without_blame()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        var points = (await bat.C.PointsAsync(), await saruul.C.PointsAsync());
        await w.AdvanceAsync(TimeSpan.FromDays(8));
        await w.SweepAsync();
        (await bat.C.BondAsync(bond.Id)).State.Should().Be("Faded");
        (await bat.C.PointsAsync(), await saruul.C.PointsAsync()).Should().Be(points);
    }

    [Fact]
    public async Task Sever_closes_the_letters_for_both()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await using var hers = await w.F.ListenAsync(saruul.S);
        (await saruul.C.PostAsync($"/bonds/{bond.Id}/sever", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await hers.WaitForAsync(LiveKinds.BondUpdated)).Should().NotBeNull();
        var seen = await bat.C.BondAsync(bond.Id);
        seen.State.Should().Be("Severed");
        seen.ClosedByMe.Should().BeFalse();
        (await CodeOf(await bat.C.WriteRawAsync(bond.Id, "wait"))).Should().Be("bond.closed");
    }

    [Fact]
    public async Task A_stranger_cannot_read_or_write_a_bond()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var other = await w.PersonAsync("Oyun", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        (await other.C.GetAsync($"/bonds/{bond.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.C.GetAsync($"/bonds/{bond.Id}/letters")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.C.WriteRawAsync(bond.Id, "hi")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
