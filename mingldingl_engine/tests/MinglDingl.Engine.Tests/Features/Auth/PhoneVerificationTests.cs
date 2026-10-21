using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Auth;

public class PhoneVerificationTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<VerificationState> StateOf(EngineFactory f, Guid id)
    {
        await using var scope = f.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDb>().Set<PhoneVerification>()
            .Where(v => v.Id == id).Select(v => v.State).SingleAsync();
    }

    [Fact]
    public async Task Start_texts_a_code_and_never_returns_it()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var r = await f.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest(SessionDriver.NewPhone(), null));
        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await r.Content.ReadAsStringAsync();
        body.Should().NotContain(ws.LastCode);
        var s = (await r.Content.ReadFromJsonAsync<StartResponse>())!;
        s.ResendAt.Should().Be(f.Clock.UtcNow + PhoneVerificationService.ResendAfter);
        ws.SendCalls.Should().Be(1);
    }

    [Fact]
    public async Task Bad_phone_is_400()
    {
        await using var f = new EngineFactory(db); f.UseScriptedWeSend();
        var r = await f.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest("12ab", null));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Right_code_verifies()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        await c.CheckAsync(ws, s.VerificationId);
        (await StateOf(f, s.VerificationId)).Should().Be(VerificationState.Verified);
        // A retry after a lost answer is still verified.
        await c.CheckAsync(ws, s.VerificationId);
    }

    [Fact]
    public async Task Wrong_code_may_be_typed_again_until_five()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        var wrong = await c.CheckRawAsync(s.VerificationId, "999999");
        wrong.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await CodeOf(wrong)).Should().Be("auth.wrong_code");
        await c.CheckAsync(ws, s.VerificationId);

        var t = await c.StartAsync(SessionDriver.NewPhone());
        for (var i = 0; i < 4; i++) await c.CheckRawAsync(t.VerificationId, "999999");
        var fifth = await c.CheckRawAsync(t.VerificationId, "999999");
        (await CodeOf(fifth)).Should().Be("auth.too_many_attempts");
        (await CodeOf(await c.CheckRawAsync(t.VerificationId, ws.LastCode))).Should().Be("auth.verification_expired");
    }

    [Fact]
    public async Task Expired_code_needs_a_new_one()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        ws.ExpireLast();
        var r = await c.CheckRawAsync(s.VerificationId, ws.LastCode);
        r.StatusCode.Should().Be(HttpStatusCode.Gone);
        (await CodeOf(r)).Should().Be("auth.verification_expired");
    }

    [Fact]
    public async Task An_outlived_code_expires_without_asking_WeSend()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        f.Clock.Advance(TimeSpan.FromSeconds(WeSendClient.CodeTtl + 1));
        (await CodeOf(await c.CheckRawAsync(s.VerificationId, ws.LastCode))).Should().Be("auth.verification_expired");
    }

    [Fact]
    public async Task A_second_code_waits_a_minute_and_then_cancels_the_first()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var phone = SessionDriver.NewPhone();
        var first = await c.StartAsync(phone);
        var soon = await c.PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, null));
        soon.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await CodeOf(soon)).Should().Be("auth.code_cooldown");
        ws.SendCalls.Should().Be(1);

        f.Clock.Advance(PhoneVerificationService.ResendAfter);
        var firstCode = ws.LastCode;
        var second = await c.StartAsync(phone);
        second.VerificationId.Should().NotBe(first.VerificationId);
        (await StateOf(f, first.VerificationId)).Should().Be(VerificationState.Superseded);
        (await CodeOf(await c.CheckRawAsync(first.VerificationId, firstCode))).Should().Be("auth.verification_expired");
        await c.CheckAsync(ws, second.VerificationId);
    }

    [Fact]
    public async Task Start_never_returns_an_existing_pending_session_to_a_caller_who_cannot_name_it()
    {
        await using var f = new EngineFactory(db); f.UseScriptedWeSend();
        var phone = SessionDriver.NewPhone();
        var owner = await f.Client().StartAsync(phone);
        f.Clock.Advance(PhoneVerificationService.ResendAfter);
        var stranger = await f.Client().StartAsync(phone);
        stranger.VerificationId.Should().NotBe(owner.VerificationId);
    }

    [Fact]
    public async Task Start_with_resume_id_returns_that_session_without_a_second_text()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var phone = SessionDriver.NewPhone();
        var first = await f.Client().StartAsync(phone);
        var again = await f.Client().StartAsync(phone, first.VerificationId);
        again.VerificationId.Should().Be(first.VerificationId);
        ws.SendCalls.Should().Be(1);
    }

    [Fact]
    public async Task Resume_id_for_another_number_is_ignored()
    {
        await using var f = new EngineFactory(db); f.UseScriptedWeSend();
        var mine = await f.Client().StartAsync(SessionDriver.NewPhone());
        var other = await f.Client().StartAsync(SessionDriver.NewPhone(), mine.VerificationId);
        other.VerificationId.Should().NotBe(mine.VerificationId);
    }

    [Fact]
    public async Task Concurrent_starts_for_one_number_send_one_text()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var phone = SessionDriver.NewPhone();
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => f.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, null))));
        ws.SendCalls.Should().Be(1);
        await using var scope = f.Services.CreateAsyncScope();
        (await scope.ServiceProvider.GetRequiredService<AppDb>().Set<PhoneVerification>()
            .CountAsync(v => v.Phone == phone && v.State == VerificationState.Pending)).Should().Be(1);
    }

    [Fact]
    public async Task Unknown_verification_is_404()
    {
        await using var f = new EngineFactory(db); f.UseScriptedWeSend();
        var r = await f.Client().CheckRawAsync(Guid.NewGuid(), "000000");
        r.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(CodeSent.Unavailable, HttpStatusCode.ServiceUnavailable, "auth.provider_unavailable")]
    [InlineData(CodeSent.TooMany, HttpStatusCode.TooManyRequests, "auth.too_many_codes")]
    [InlineData(CodeSent.BadNumber, HttpStatusCode.BadRequest, "auth.bad_phone")]
    public async Task A_refused_send_supersedes_nothing(CodeSent refusal, HttpStatusCode status, string code)
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        var phone = SessionDriver.NewPhone();
        var first = await c.StartAsync(phone);
        f.Clock.Advance(PhoneVerificationService.ResendAfter);
        ws.FailSend = refusal;
        var r = await c.PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, null));
        r.StatusCode.Should().Be(status);
        (await CodeOf(r)).Should().Be(code);
        (await StateOf(f, first.VerificationId)).Should().Be(VerificationState.Pending);
    }

    [Fact]
    public void Fake_WeSend_is_refused_outside_development()
    {
        using var f = new EngineFactory(db).WithEnvironment("Production").WithSetting("WeSend:Fake", "true");
        var act = () => f.Client();
        act.Should().Throw<Exception>().Where(e => e.ToString().Contains("WeSend:Fake"));
    }

    [Fact]
    public async Task Dev_fake_takes_000000_and_keeps_one_number_that_expires()
    {
        var fake = new FakeWeSend();
        var s = await fake.SendCodeAsync("88112233", "mn");
        (await fake.CheckAsync(s.Id!, "123456")).Should().Be(CodeChecked.Wrong);
        (await fake.CheckAsync(s.Id!, FakeWeSend.Code)).Should().Be(CodeChecked.Approved);
        var e = await fake.SendCodeAsync(FakeWeSend.Expires, "mn");
        (await fake.CheckAsync(e.Id!, FakeWeSend.Code)).Should().Be(CodeChecked.Expired);
    }
}
