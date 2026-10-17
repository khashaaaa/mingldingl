using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Auth;

public class PhoneVerificationTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static int _phone = 88000000;
    private static string NewPhone() => Interlocked.Increment(ref _phone).ToString();

    [Fact]
    public async Task Start_returns_a_new_session_for_an_unknown_caller()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var s = await f.Client().StartAsync(NewPhone());
        s.Code.Should().MatchRegex("^[0-9]{6}$");
        s.SmsUri.Should().StartWith("sms:144773");
        s.DisplayInstruction.Should().Contain(s.Code);
    }

    [Fact]
    public async Task Bad_phone_is_400()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var r = await f.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest("12ab", null));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Start_never_returns_an_existing_pending_session_to_a_caller_who_cannot_name_it()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var phone = NewPhone();
        var owner = await f.Client().StartAsync(phone);
        var attacker = await f.Client().StartAsync(phone);
        attacker.VerificationId.Should().NotBe(owner.VerificationId);
        attacker.Code.Should().NotBe(owner.Code);
    }

    [Fact]
    public async Task Start_with_resume_id_returns_that_session_when_pending_and_same_number()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = NewPhone();
        var first = await f.Client().StartAsync(phone);
        var again = await f.Client().StartAsync(phone, first.VerificationId);
        again.VerificationId.Should().Be(first.VerificationId);
        again.Code.Should().Be(first.Code);
        vm.OpenCalls.Should().Be(1);
    }

    [Fact]
    public async Task Resume_id_for_another_number_is_ignored()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var mine = await f.Client().StartAsync(NewPhone());
        var other = await f.Client().StartAsync(NewPhone(), mine.VerificationId);
        other.VerificationId.Should().NotBe(mine.VerificationId);
    }

    [Fact]
    public async Task Sixth_start_supersedes_the_oldest_pending()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var phone = NewPhone();
        var starts = new List<StartResponse>();
        for (var i = 0; i < 6; i++) starts.Add(await f.Client().StartAsync(phone));
        (await f.Client().StatusAsync(starts[0].VerificationId)).Should().Be("superseded");
        (await f.Client().StatusAsync(starts[5].VerificationId)).Should().Be("pending");
    }

    [Fact]
    public async Task Superseded_session_still_verifies_and_is_resumable_by_id()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = NewPhone();
        var first = await f.Client().StartAsync(phone);
        for (var i = 0; i < 5; i++) await f.Client().StartAsync(phone);
        (await f.Client().StartAsync(phone, first.VerificationId)).VerificationId.Should().Be(first.VerificationId);
        vm.VerifyCode(first.Code);
        (await f.Client().StatusAsync(first.VerificationId)).Should().Be("verified");
    }

    [Fact]
    public async Task Concurrent_starts_for_one_number_never_exceed_five_live()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var phone = NewPhone();
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => f.Client().StartAsync(phone)));
        await using var scope = f.Services.CreateAsyncScope();
        var pending = await scope.ServiceProvider.GetRequiredService<AppDb>().Set<PhoneVerification>()
            .CountAsync(v => v.Phone == phone && v.State == VerificationState.Pending);
        pending.Should().Be(5);
    }

    [Fact]
    public async Task Status_rereads_the_provider()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.Client().StartAsync(NewPhone());
        (await f.Client().StatusAsync(s.VerificationId)).Should().Be("pending");
        vm.VerifyCode(s.Code);
        (await f.Client().StatusAsync(s.VerificationId)).Should().Be("verified");
    }

    [Fact]
    public async Task Expired_session_reports_expired()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.Client().StartAsync(NewPhone());
        vm.ExpireCode(s.Code);
        (await f.Client().StatusAsync(s.VerificationId)).Should().Be("expired");
    }

    [Fact]
    public async Task Unknown_verification_is_404()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var r = await f.Client().GetAsync($"/auth/phone/status/{Guid.NewGuid()}");
        r.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Provider_failure_is_502_and_supersedes_nothing()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = NewPhone();
        var first = await f.Client().StartAsync(phone);
        vm.FailOpen = true;
        var r = await f.Client().PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, null));
        r.StatusCode.Should().Be(HttpStatusCode.BadGateway);
        (await f.Client().StatusAsync(first.VerificationId)).Should().Be("pending");
    }

    [Fact]
    public void Fake_verify_is_refused_outside_development()
    {
        using var f = new EngineFactory(db).WithEnvironment("Production").WithSetting("VerifyMn:Fake", "true");
        var act = () => f.Client();
        act.Should().Throw<Exception>().Where(e => e.ToString().Contains("VerifyMn:Fake"));
    }

    [Fact]
    public async Task Dev_fake_verifies_on_first_status_read()
    {
        var fake = new FakeVerifyMnClient();
        var s = (await fake.OpenAsync("88112233", "123456"))!;
        (await fake.ReadAsync(s.SessionId))!.SessionStatus.Should().Be("VERIFIED");
    }

    [Theory]
    [InlineData(FakeVerifyMnClient.StaysPending, "PENDING")]
    [InlineData(FakeVerifyMnClient.Expires, "EXPIRED")]
    public async Task Dev_fake_keeps_two_numbers_for_the_screens_a_real_text_reaches(string phone, string status)
    {
        var fake = new FakeVerifyMnClient();
        var s = (await fake.OpenAsync(phone, "123456"))!;
        (await fake.ReadAsync(s.SessionId))!.SessionStatus.Should().Be(status);
    }
}
