using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Auth;

public class SessionTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<int> AccountsWithPhone(EngineFactory f, string phone)
    {
        await using var scope = f.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDb>().Set<Account>().CountAsync(a => a.Phone == phone);
    }

    private static async Task<string?> ErrorCode(HttpResponseMessage r) =>
        (await r.Content.ReadFromJsonAsync<ErrorBody>())?.Code;

    [Fact]
    public async Task Complete_creates_account_and_returns_pair()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = SessionDriver.NewPhone();
        var s = await f.SignInAsync(vm, phone);
        s.AccessToken.Should().NotBeNullOrEmpty();
        s.RefreshToken.Should().NotBeNullOrEmpty();
        (await AccountsWithPhone(f, phone)).Should().Be(1);
    }

    [Fact]
    public async Task Complete_signs_in_existing_account_for_same_number()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = SessionDriver.NewPhone();
        var a = await f.SignInAsync(vm, phone, "phone-a");
        var b = await f.SignInAsync(vm, phone, "phone-b");
        b.AccountId.Should().Be(a.AccountId);
        (await AccountsWithPhone(f, phone)).Should().Be(1);
    }

    [Fact]
    public async Task Complete_is_single_use()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        vm.VerifyCode(s.Code);
        (await c.CompleteRawAsync(s.VerificationId)).StatusCode.Should().Be(HttpStatusCode.OK);
        var again = await c.CompleteRawAsync(s.VerificationId);
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ErrorCode(again)).Should().Be("auth.already_claimed");
    }

    [Fact]
    public async Task Concurrent_completes_with_one_verification_yield_one_session()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        vm.VerifyCode(s.Code);
        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => f.Client().CompleteRawAsync(s.VerificationId)));
        results.Count(r => r.StatusCode == HttpStatusCode.OK).Should().Be(1);
    }

    [Fact]
    public async Task Complete_refused_when_not_verified()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        var r = await c.CompleteRawAsync(s.VerificationId);
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ErrorCode(r)).Should().Be("auth.not_verified");
    }

    [Fact]
    public async Task Complete_refused_after_claim_window()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var c = f.Client();
        var s = await c.StartAsync(SessionDriver.NewPhone());
        vm.VerifyCode(s.Code);
        await c.StatusAsync(s.VerificationId);
        f.Clock.Advance(TimeSpan.FromMinutes(31));
        var r = await c.CompleteRawAsync(s.VerificationId);
        (await ErrorCode(r)).Should().Be("auth.verification_expired");
    }

    [Fact]
    public async Task Signups_closed_refuses_new_number_but_not_existing()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var existing = SessionDriver.NewPhone();
        await f.SignInAsync(vm, existing);
        await using (var scope = f.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync(ConfigKeys.SignupsEnabled, "false");
        try
        {
            var c = f.Client();
            var s = await c.StartAsync(SessionDriver.NewPhone());
            vm.VerifyCode(s.Code);
            var r = await c.CompleteRawAsync(s.VerificationId);
            r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await ErrorCode(r)).Should().Be("signups.closed");
            await f.SignInAsync(vm, existing);
        }
        finally
        {
            await using var scope = f.Services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<ConfigWrites>().SetAsync(ConfigKeys.SignupsEnabled, "true");
        }
    }

    [Fact]
    public async Task Refresh_rotates_and_new_access_token_works()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        var r = await f.Client().RefreshRawAsync(s.RefreshToken);
        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var next = (await r.Content.ReadFromJsonAsync<SessionPair>())!;
        next.RefreshToken.Should().NotBe(s.RefreshToken);
        (await f.As(next).PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Refresh_twice_within_grace_returns_same_pair()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        var a = await (await f.Client().RefreshRawAsync(s.RefreshToken)).Content.ReadFromJsonAsync<SessionPair>();
        f.Clock.Advance(TimeSpan.FromSeconds(20));
        var r = await f.Client().RefreshRawAsync(s.RefreshToken);
        r.StatusCode.Should().Be(HttpStatusCode.OK);
        (await r.Content.ReadFromJsonAsync<SessionPair>())!.RefreshToken.Should().Be(a!.RefreshToken);
    }

    [Fact]
    public async Task Refresh_with_old_token_after_grace_revokes_device()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        var next = (await (await f.Client().RefreshRawAsync(s.RefreshToken)).Content.ReadFromJsonAsync<SessionPair>())!;
        f.Clock.Advance(TimeSpan.FromSeconds(31));
        var replay = await f.Client().RefreshRawAsync(s.RefreshToken);
        replay.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ErrorCode(replay)).Should().Be("auth.reused");
        var afterTheft = await f.Client().RefreshRawAsync(next.RefreshToken);
        (await ErrorCode(afterTheft)).Should().Be("auth.revoked");
    }

    [Fact]
    public async Task Concurrent_refreshes_with_one_token_all_succeed_with_one_pair()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => f.Client().RefreshRawAsync(s.RefreshToken)));
        results.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        var tokens = await Task.WhenAll(results.Select(async r => (await r.Content.ReadFromJsonAsync<SessionPair>())!.RefreshToken));
        tokens.Distinct().Should().HaveCount(1);
    }

    [Fact]
    public async Task Unknown_refresh_token_is_401()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var r = await f.Client().RefreshRawAsync("not-a-token");
        r.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ErrorCode(r)).Should().Be("auth.invalid_refresh");
    }

    [Fact]
    public async Task Access_token_of_revoked_device_is_rejected()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        (await f.As(s).PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await f.As(s).PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Sign_out_revokes_only_this_device()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = SessionDriver.NewPhone();
        var a = await f.SignInAsync(vm, phone, "a");
        var b = await f.SignInAsync(vm, phone, "b");
        await f.As(a).PostAsync("/auth/sign-out", null);
        (await f.Client().RefreshRawAsync(a.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await f.Client().RefreshRawAsync(b.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Sign_out_all_revokes_every_device()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var phone = SessionDriver.NewPhone();
        var a = await f.SignInAsync(vm, phone, "a");
        var b = await f.SignInAsync(vm, phone, "b");
        (await f.As(a).PostAsync("/auth/sign-out-all", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await f.Client().RefreshRawAsync(a.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await f.Client().RefreshRawAsync(b.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await f.As(b).PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Expired_access_token_is_401()
    {
        await using var f = new EngineFactory(db); var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        f.Clock.Advance(TimeSpan.FromMinutes(16)); // access tokens live 15 minutes
        (await f.As(s).PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Garbage_bearer_is_401()
    {
        await using var f = new EngineFactory(db); f.UseScriptedVerifyMn();
        var c = f.Client();
        c.DefaultRequestHeaders.Authorization = new("Bearer", "abc.def.ghi");
        (await c.PostAsync("/auth/sign-out", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
