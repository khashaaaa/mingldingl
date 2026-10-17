using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Video;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Video;

public class VideoTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private const string AppId = "970CA35de60c44645bbae8a215061b33";
    private const string Cert = "5CFd2fd1755d40ecb72977518be15d3b";
    private const string Secret = "ncs-secret";

    private static void Agora(EngineFactory f) => f
        .WithSetting("Agora:AppId", AppId).WithSetting("Agora:AppCertificate", Cert).WithSetting("Agora:NcsSecret", Secret);

    /// A pair whose icebreaker is answered: the Rite is open to them.
    private static async Task<(World W, World.Person Bat, World.Person Saruul, Guid Bond)> OpenRiteAsync(
        PostgresFixture db, Action<EngineFactory>? more = null)
    {
        var w = await World.CreateAsync(db, f => { Agora(f); more?.Invoke(f); });
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 5);
        (await bat.C.IcebreakerRawAsync(bond, "Terelj")).EnsureSuccessStatusCode();
        (await saruul.C.IcebreakerRawAsync(bond, "Khövsgöl")).EnsureSuccessStatusCode();
        return (w, bat, saruul, bond);
    }

    private static async Task<CallTicket> CallAsync(HttpClient c, Guid bond) =>
        await (await c.PostAsync($"/bonds/{bond}/rite/call", null)).Read<CallTicket>();

    private static Task<HttpResponseMessage> PresenceAsync(HttpClient c, Guid call, bool joined) =>
        c.PostAsJsonAsync($"/video/calls/{call}/presence", new PresenceRequest(joined));

    [Fact]
    public void A_token_carries_its_channel_and_is_signed_with_the_certificate()
    {
        var token = AgoraToken.BuildRtc(AppId, Cert, "rite-abc", 2, 600, issuedAt: 1_111_111, salt: 1);
        token.Should().StartWith("007");
        AgoraToken.BuildRtc(AppId, Cert, "rite-abc", 2, 600, issuedAt: 1_111_111, salt: 1).Should().Be(token);

        var t = AgoraToken.Read(token);
        (t.AppId, t.IssuedAt, t.Expire, t.Salt, t.Channel, t.Uid).Should().Be((AppId, 1_111_111u, 600u, 1u, "rite-abc", "2"));
        t.Signature.Should().Equal(AgoraToken.Sign(Cert, 1_111_111, 1, t.Signed));
        t.Signature.Should().NotEqual(AgoraToken.Sign("0" + Cert[1..], 1_111_111, 1, t.Signed));
    }

    [Fact]
    public async Task The_rite_waits_for_the_icebreaker_and_for_the_other_to_answer()
    {
        await using var w = await World.CreateAsync(db, Agora);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite", null))).Should().Be("rite.closed");
    }

    [Fact]
    public async Task Asking_answering_and_a_call_that_lasts_long_enough_completes_the_rite_once()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite", null))).Should().Be("rite.proposed");
        (await CodeOf(await bat.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true)))).Should().Be("rite.own");
        var asked = await saruul.C.EncounterAsync(bond);
        asked.Rite!.State.Should().Be("proposedByThem");
        asked.Next.Should().Be("rite", "a request from the other side comes before her own steps");
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite/call", null))).Should().Be("rite.not_agreed");
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();

        var his = await CallAsync(bat.C, bond);
        var hers = await CallAsync(saruul.C, bond);
        hers.CallId.Should().Be(his.CallId, "both step into the same attempt");
        (his.Uid, hers.Uid).Should().NotBe((hers.Uid, his.Uid));
        AgoraToken.Read(his.Token).Channel.Should().Be(his.Channel);

        (await PresenceAsync(bat.C, his.CallId, true)).EnsureSuccessStatusCode();
        (await PresenceAsync(saruul.C, his.CallId, true)).EnsureSuccessStatusCode();
        (await bat.C.EncounterAsync(bond)).Rite!.Call!.EndsAt.Should().NotBeNull("the five minutes run once both are in");
        await w.AdvanceAsync(TimeSpan.FromSeconds(50));
        (await PresenceAsync(bat.C, his.CallId, false)).EnsureSuccessStatusCode();
        (await bat.C.EncounterAsync(bond)).Rite!.State.Should().Be("accepted", "50 seconds together is not yet the Rite");

        var before = await saruul.C.PointsAsync();
        (await PresenceAsync(bat.C, his.CallId, true)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromSeconds(15));
        (await saruul.C.PostAsync($"/bonds/{bond}/rite/douse", null)).EnsureSuccessStatusCode();
        var after = await bat.C.EncounterAsync(bond);
        after.Rite!.State.Should().Be("done");
        after.Rite.Call.Should().BeNull("the attempt ended for both");
        (await saruul.C.PointsAsync()).Should().Be(before + 30);
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite/call", null))).Should().Be("rite.done");
        after.Meeting.Should().BeNull("the meeting step waits for the third seal");
    }

    [Fact]
    public async Task An_app_that_comes_back_without_leaving_keeps_the_time_already_shared()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();
        var call = await CallAsync(bat.C, bond);
        (await PresenceAsync(bat.C, call.CallId, true)).EnsureSuccessStatusCode();
        (await PresenceAsync(saruul.C, call.CallId, true)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromSeconds(45));
        (await PresenceAsync(bat.C, call.CallId, true)).EnsureSuccessStatusCode(); // crashed, back in
        await w.AdvanceAsync(TimeSpan.FromSeconds(20));
        (await PresenceAsync(saruul.C, call.CallId, false)).EnsureSuccessStatusCode();
        (await bat.C.EncounterAsync(bond)).Rite!.State.Should().Be("done", "65 seconds together, crash or not");
    }

    [Fact]
    public async Task A_leave_reported_as_the_five_minutes_run_out_still_counts()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();
        var call = await CallAsync(bat.C, bond);
        (await PresenceAsync(bat.C, call.CallId, true)).EnsureSuccessStatusCode();
        (await PresenceAsync(saruul.C, call.CallId, true)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromMinutes(5) + TimeSpan.FromSeconds(2));
        (await PresenceAsync(bat.C, call.CallId, false)).EnsureSuccessStatusCode();
        (await bat.C.EncounterAsync(bond)).Rite!.State.Should().Be("done", "the app leaves at 0:00, a moment late");
        (await CodeOf(await PresenceAsync(saruul.C, call.CallId, true))).Should().Be("call.over", "no joining after the end");
    }

    [Fact]
    public async Task A_new_attempt_counts_the_one_whose_time_ran_out_unreported()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();
        var call = await CallAsync(bat.C, bond);
        (await PresenceAsync(bat.C, call.CallId, true)).EnsureSuccessStatusCode();
        (await PresenceAsync(saruul.C, call.CallId, true)).EnsureSuccessStatusCode();
        var before = await bat.C.PointsAsync();
        await w.AdvanceAsync(TimeSpan.FromMinutes(6)); // both apps closed without a word
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite/call", null))).Should().Be("rite.done");
        (await bat.C.EncounterAsync(bond)).Rite!.State.Should().Be("done");
        (await bat.C.PointsAsync()).Should().Be(before + 30);
    }

    [Fact]
    public async Task Not_now_makes_the_asker_wait_before_asking_again()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(false))).EnsureSuccessStatusCode();
        (await CodeOf(await bat.C.PostAsync($"/bonds/{bond}/rite", null))).Should().Be("rite.wait");
        (await bat.C.EncounterAsync(bond)).Rite!.CanProposeAt.Should().NotBeNull();
        (await saruul.C.PostAsync($"/bonds/{bond}/rite", null)).IsSuccessStatusCode.Should().BeTrue("the one who said not now may ask");
    }

    [Fact]
    public async Task Agoras_notices_count_only_when_signed()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db);
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();
        var ticket = await CallAsync(bat.C, bond);
        var t0 = w.F.Clock.UtcNow.ToUnixTimeSeconds();
        var anon = w.F.Client();

        async Task<HttpStatusCode> Notice(int type, uint uid, long ts, string? secret = Secret)
        {
            var body = $$$"""{"noticeId":"n{{{type}}}{{{uid}}}{{{ts}}}","productId":1,"eventType":{{{type}}},"notifyMs":0,"payload":{"channelName":"{{{ticket.Channel}}}","uid":{{{uid}}},"platform":1,"clientSeq":1,"ts":{{{ts}}}}}""";
            var req = new HttpRequestMessage(HttpMethod.Post, "/video/ncs") { Content = new StringContent(body, Encoding.UTF8, "application/json") };
            var sig = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret ?? "wrong"), Encoding.UTF8.GetBytes(body)));
            req.Headers.Add("Agora-Signature-V2", sig);
            return (await anon.SendAsync(req)).StatusCode;
        }

        (await Notice(103, 1, t0, secret: null)).Should().Be(HttpStatusCode.Unauthorized);
        (await Notice(103, 1, t0)).Should().Be(HttpStatusCode.OK);
        (await Notice(103, 2, t0 + 5)).Should().Be(HttpStatusCode.OK);
        (await Notice(104, 2, t0 + 70)).Should().Be(HttpStatusCode.OK);
        (await bat.C.EncounterAsync(bond)).Rite!.State.Should().Be("done");
    }

    [Fact]
    public async Task Outside_development_the_app_cannot_report_its_own_presence()
    {
        var (w, bat, saruul, bond) = await OpenRiteAsync(db, f => f.WithServices(s =>
        {
            s.RemoveAll<AgoraSettings>();
            s.AddSingleton(new AgoraSettings(AppId, Cert, Secret, DevPresence: false));
        }));
        await using var _w = w;
        (await bat.C.PostAsync($"/bonds/{bond}/rite", null)).EnsureSuccessStatusCode();
        (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/rite/answer", new RiteAnswerRequest(true))).EnsureSuccessStatusCode();
        var ticket = await CallAsync(bat.C, bond);
        (await PresenceAsync(bat.C, ticket.CallId, true)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public void Outside_development_video_without_the_ncs_secret_fails_startup()
    {
        using var f = new EngineFactory(db).WithEnvironment("Production")
            .WithSetting("Cors:AllowedOrigins", "https://admin.example").WithSetting("Agora:NcsSecret", "");
        var act = () => f.Client();
        act.Should().Throw<Exception>().Where(e => e.ToString().Contains("Agora:NcsSecret"));
    }
}
