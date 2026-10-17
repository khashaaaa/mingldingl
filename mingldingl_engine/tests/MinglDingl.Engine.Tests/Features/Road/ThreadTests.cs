using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Threads;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Road;

public class ThreadTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Two_yeses_tie_a_thread_into_a_bond_neither_summoned_and_the_weaver_earns_its_due()
    {
        await using var w = await World.CreateAsync(db);
        var weaver = await w.PersonAsync("Bat", "Male");
        var (pa, pb) = (SessionDriver.NewPhone(), SessionDriver.NewPhone());
        var anu = await w.PersonAsync("Anu", "Female", phone: pa);

        (await CodeOf(await weaver.C.PostAsJsonAsync("/threads", new WeaveRequest(pa, pa)))).Should().Be("threads.same");
        var woven = await (await weaver.C.PostAsJsonAsync("/threads", new WeaveRequest(pa, pb))).Read<WovenView>();
        woven.FirstCode.Should().HaveLength(6).And.NotBe(woven.SecondCode);

        // The second has no character yet; the number is the key, so it finds the thread once they arrive.
        var inv = (await anu.C.GetFromJsonAsync<List<InvitationView>>("/threads/for-me"))!.Single();
        inv.Should().Match<InvitationView>(i => i.Weaver == "Bat" && i.MyAnswer == null && i.State == "waiting");
        (await anu.C.PostAsJsonAsync($"/threads/{inv.Id}/answer", new ThreadAnswerRequest(true))).EnsureSuccessStatusCode();
        var dorj = await w.PersonAsync("Dorj", "Male", phone: pb);
        (await dorj.C.GetFromJsonAsync<List<InvitationView>>("/threads/for-me"))!.Single().State.Should().Be("oneSaidYes");
        var before = await weaver.C.PointsAsync();
        (await dorj.C.PostAsJsonAsync($"/threads/{inv.Id}/answer", new ThreadAnswerRequest(true))).EnsureSuccessStatusCode();

        var bond = (await anu.C.BondsAsync()).Should().ContainSingle().Subject;
        bond.OtherName.Should().Be("Dorj");
        (await anu.C.BondAsync(bond.Id)).SummonedByMe.Should().BeFalse("the weaver made it");
        (await dorj.C.BondAsync(bond.Id)).SummonedByMe.Should().BeFalse();
        (await weaver.C.PointsAsync()).Should().Be(before + 40);
        (await weaver.C.GetFromJsonAsync<List<WovenRow>>("/threads/woven"))!.Single()
            .Should().Match<WovenRow>(r => r.First == "Anu" && r.State == "sparked" && r.Points == 40);
        (await weaver.C.GetFromJsonAsync<List<HonourView>>("/me/honours"))!.Single(h => h.Key == HonourKeys.ThreadWeaver).Earned.Should().BeTrue();
        (await anu.C.SeekAsync()).CandlesLeft.Should().Be((await anu.C.SeekAsync()).CandlesPerDay, "a thread spends no candle");
    }

    [Fact]
    public async Task A_no_or_a_pair_seek_would_refuse_cuts_the_thread_and_two_a_day_is_the_limit()
    {
        await using var w = await World.CreateAsync(db);
        var weaver = await w.PersonAsync("Bat", "Male");
        var (pa, pb, pc) = (SessionDriver.NewPhone(), SessionDriver.NewPhone(), SessionDriver.NewPhone());
        var anu = await w.PersonAsync("Anu", "Female", phone: pa);
        var saraa = await w.PersonAsync("Saraa", "Female", phone: pb);
        var t1 = await (await weaver.C.PostAsJsonAsync("/threads", new WeaveRequest(pa, pb))).Read<WovenView>();
        (await anu.C.PostAsJsonAsync($"/threads/{t1.Id}/answer", new ThreadAnswerRequest(true))).EnsureSuccessStatusCode();
        (await saraa.C.PostAsJsonAsync($"/threads/{t1.Id}/answer", new ThreadAnswerRequest(true))).EnsureSuccessStatusCode();
        (await anu.C.BondsAsync()).Should().BeEmpty("two women: the pair Seek would never offer");

        var t2 = await (await weaver.C.PostAsJsonAsync("/threads", new WeaveRequest(pa, pc))).Read<WovenView>();
        (await anu.C.PostAsJsonAsync($"/threads/{t2.Id}/answer", new ThreadAnswerRequest(false))).EnsureSuccessStatusCode();
        (await weaver.C.GetFromJsonAsync<List<WovenRow>>("/threads/woven"))!.Select(r => r.State).Should().Equal("cut", "cut");
        (await anu.C.GetFromJsonAsync<List<InvitationView>>("/threads/for-me"))!.Should().BeEmpty();
        (await CodeOf(await weaver.C.PostAsJsonAsync("/threads", new WeaveRequest(pb, pc)))).Should().Be("threads.limit");
    }

    [Fact]
    public async Task An_allys_code_at_sign_up_pays_both_when_the_newcomer_finishes()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var call = (await bat.C.GetFromJsonAsync<AllyView>("/me/ally"))!;
        call.Code.Should().MatchRegex("^[A-Z]{4}-[0-9]{4}$");
        (await bat.C.GetFromJsonAsync<AllyView>("/me/ally"))!.Code.Should().Be(call.Code, "one call per person");
        var before = await bat.C.PointsAsync();

        var anu = await w.PersonAsync("Anu", "Female", allyCode: call.Code.ToLowerInvariant());
        (await bat.C.PointsAsync()).Should().Be(before + 50);
        var deeds = (await anu.C.GetFromJsonAsync<DeedPage>("/me/deeds"))!.Items;
        deeds.Should().Contain(d => d.Kind == DeedKinds.Ally && d.Amount == 50);
        (await bat.C.GetFromJsonAsync<AllyView>("/me/ally"))!.Answered.Should().Be(1);
        (await bat.C.GetFromJsonAsync<List<HonourView>>("/me/honours"))!.Single(h => h.Key == HonourKeys.AllyCaller).Earned.Should().BeTrue();
    }
}
