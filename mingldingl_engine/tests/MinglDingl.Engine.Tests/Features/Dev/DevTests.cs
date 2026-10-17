using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Maintenance;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Dev;

public class DevTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Dev_endpoints_are_404_outside_development()
    {
        await using var f = new EngineFactory(db).WithEnvironment("Production").WithSetting("Cors:AllowedOrigins", "https://admin.example");
        (await f.Client().PostAsJsonAsync("/dev/run-sweep", new { })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Dev_config_sets_a_value_without_the_admin_password_and_404s_elsewhere()
    {
        await using var f = new EngineFactory(db);
        (await f.Client().PutAsJsonAsync("/dev/config/app.minVersion", new { value = "99.0.0" })).EnsureSuccessStatusCode();
        (await f.Client().GetFromJsonAsync<AppStatusView>("/app/status"))!.MinVersion.Should().Be("99.0.0");
        (await f.Client().PutAsJsonAsync("/dev/config/app.minVersion", new { value = "1.0.0" })).EnsureSuccessStatusCode();

        await using var prod = new EngineFactory(db).WithEnvironment("Production").WithSetting("Cors:AllowedOrigins", "https://admin.example");
        (await prod.Client().PutAsJsonAsync("/dev/config/app.minVersion", new { value = "99.0.0" })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(SeedState.Step1, 1)]
    [InlineData(SeedState.Step2, 2)]
    [InlineData(SeedState.Step3, 3)]
    [InlineData(SeedState.Step4, 4)]
    [InlineData(SeedState.Step5, 5)]
    [InlineData(SeedState.Step6, 6)]
    [InlineData(SeedState.Finished, 7)]
    public async Task Dev_state_moves_onboarding_step(SeedState state, int step)
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn(); f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        (await c.PostAsJsonAsync("/dev/me/state", new DevStateRequest(state))).StatusCode.Should().Be(HttpStatusCode.OK);
        (await c.MeAsync()).OnboardingStep.Should().Be(step);
        // and back again: states are absolute, not steps forward
        await c.PostAsJsonAsync("/dev/me/state", new DevStateRequest(SeedState.Step1));
        (await c.MeAsync()).OnboardingStep.Should().Be(1);
        (await c.PhotosAsync()).Should().BeEmpty();
    }

    [Fact]
    public async Task Dev_state_publishes_profile_and_photos_updated()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn(); f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm);
        await using var l = await f.ListenAsync(s);
        await f.As(s).PostAsJsonAsync("/dev/me/state", new DevStateRequest(SeedState.Finished));
        (await l.WaitForAsync(LiveKinds.ProfileUpdated)).Should().NotBeNull();
        (await l.WaitForAsync(LiveKinds.PhotosUpdated)).Should().NotBeNull();
    }

    [Fact]
    public async Task Dev_state_suspended_shows_in_me()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn(); f.UseMemoryPhotoStore();
        var c = f.As(await f.SignInAsync(vm));
        await c.PostAsJsonAsync("/dev/me/state", new DevStateRequest(SeedState.Suspended));
        (await c.MeAsync()).Status.Should().Be("Suspended");
        await c.PostAsJsonAsync("/dev/me/state", new DevStateRequest(SeedState.Finished)); // dev may always restore
        (await c.MeAsync()).Status.Should().Be("Active");
    }

    [Fact]
    public async Task Dev_live_publishes_any_kind_to_me()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        await using var l = await f.ListenAsync(s);
        await f.As(s).PostAsJsonAsync("/dev/me/live", new DevLiveRequest(LiveKinds.ConfigUpdated));
        (await l.WaitForAsync(LiveKinds.ConfigUpdated)).Should().NotBeNull();
    }

    [Fact]
    public async Task Sweep_clears_old_grace_payloads_and_expires_old_verifications()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        await f.Client().RefreshRawAsync(s.RefreshToken);
        var pending = await f.Client().StartAsync(SessionDriver.NewPhone());
        f.Clock.Advance(TimeSpan.FromHours(1));
        (await f.Client().PostAsJsonAsync("/dev/run-sweep", new { })).StatusCode.Should().Be(HttpStatusCode.OK);
        await using var scope = f.Services.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<AppDb>();
        (await store.Set<RefreshToken>().CountAsync(t => t.GracePayload != null)).Should().Be(0);
        (await store.Set<PhoneVerification>().SingleAsync(v => v.Id == pending.VerificationId)).State.Should().Be(VerificationState.Expired);
    }

    [Fact]
    public async Task Sweep_deletes_devices_revoked_over_30_days_ago()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn();
        var s = await f.SignInAsync(vm);
        await f.As(s).PostAsync("/auth/sign-out", null);
        f.Clock.Advance(TimeSpan.FromDays(31));
        await using var scope = f.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DailySweep>().RunAsync();
        var store = scope.ServiceProvider.GetRequiredService<AppDb>();
        (await store.Set<DeviceSession>().CountAsync(d => d.AccountId == s.AccountId)).Should().Be(0);
    }
}
