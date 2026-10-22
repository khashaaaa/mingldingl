using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;
using static MinglDingl.Engine.Tests.Infrastructure.ProfileDriver;

namespace MinglDingl.Engine.Tests.Features.Profile;

public class ProfileTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static (EngineFactory F, ScriptedWeSend Vm, object? Unused) Engine(PostgresFixture db)
    {
        var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        return (f, vm, null);
    }

    /// Gives the account exactly n portrait rows (no files: only the count matters to the step).
    private static async Task SetPhotosAsync(EngineFactory f, Guid accountId, int n)
    {
        using var scope = f.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<AppDb>();
        await store.Set<Photo>().Where(p => p.AccountId == accountId).ExecuteDeleteAsync();
        for (var i = 0; i < n; i++)
            store.Add(new Photo { Id = Guid.CreateVersion7(), AccountId = accountId, Position = i, Path = $"{accountId}/{i}.jpg", ClientKey = $"k{i}", CreatedAt = DateTimeOffset.UtcNow });
        await store.SaveChangesAsync();
    }

    [Fact]
    public async Task Me_without_profile_is_step_1()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var me = await f.As(await f.SignInAsync(vm)).MeAsync();
        me.Profile.Should().BeNull();
        me.OnboardingStep.Should().Be(1);
        me.Status.Should().Be("Active");
    }

    [Fact]
    public async Task Me_requires_a_session()
    {
        var (f, _, _) = Engine(db); await using var _f = f;
        (await f.Client().GetAsync("/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_then_step_2()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        (await c.CreateAsync("  Saruul ")).StatusCode.Should().Be(HttpStatusCode.OK);
        var me = await c.MeAsync();
        me.OnboardingStep.Should().Be(2);
        me.Profile!.Name.Should().Be("Saruul");
        me.Profile.Tier.Should().Be("Garnet");
        me.Profile.Points.Should().Be(0);
    }

    [Fact]
    public async Task Create_twice_is_409()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        var r = await c.CreateAsync();
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(r)).Should().Be("profile.exists");
    }

    [Fact]
    public async Task Step_is_derived_from_profile()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        await c.CreateAsync();
        (await c.MeAsync()).OnboardingStep.Should().Be(2);
        await c.UpdateAsync(Upd(gender: "Female"));
        (await c.MeAsync()).OnboardingStep.Should().Be(3);
        await SetPhotosAsync(f, s.AccountId, 2);
        (await c.MeAsync()).OnboardingStep.Should().Be(3);
        await SetPhotosAsync(f, s.AccountId, 3);
        (await c.MeAsync()).OnboardingStep.Should().Be(4);
        await c.UpdateAsync(Upd(bio: "Rides at dawn"));
        (await c.MeAsync()).OnboardingStep.Should().Be(4);
        await c.UpdateAsync(Upd(city: "Khan-Uul"));
        (await c.MeAsync()).OnboardingStep.Should().Be(5);
        await c.UpdateAsync(Upd(oath: "Bond"));
        (await c.MeAsync()).OnboardingStep.Should().Be(6);
        await c.UpdateAsync(Upd(welcomed: true));
        (await c.MeAsync()).OnboardingStep.Should().Be(7);
    }

    [Theory]
    [InlineData(2008, 10, 6, "profile.age")] // turns 18 tomorrow (UB)
    [InlineData(1900, 1, 1, "profile.born")] // not an age rule: no one is that old
    public async Task Age_outside_18_to_99_is_refused(int y, int m, int d, string code)
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        f.Clock.Now = DateTimeOffset.Parse("2026-10-05T04:00:00Z");
        var c = f.As(await f.SignInAsync(vm));
        var r = await c.CreateAsync(birth: new DateOnly(y, m, d));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeOf(r)).Should().Be(code);
    }

    [Fact]
    public async Task Eighteen_today_is_allowed()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        f.Clock.Now = DateTimeOffset.Parse("2026-10-05T04:00:00Z");
        var c = f.As(await f.SignInAsync(vm));
        (await c.CreateAsync(birth: new DateOnly(2008, 10, 5))).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Unknown_city_is_refused()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        var r = await c.UpdateAsync(Upd(city: "Atlantis"));
        (await CodeOf(r)).Should().Be("profile.city");
    }

    [Fact]
    public async Task Gender_cannot_change_once_set()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        await c.UpdateAsync(Upd(gender: "Male"));
        var r = await c.UpdateAsync(Upd(gender: "Female"));
        (await CodeOf(r)).Should().Be("profile.gender_locked");
        (await c.UpdateAsync(Upd(gender: "Male"))).StatusCode.Should().Be(HttpStatusCode.OK); // same value is fine
    }

    [Fact]
    public async Task Unknown_gender_or_oath_is_400()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        (await CodeOf(await c.UpdateAsync(Upd(gender: "Other")))).Should().Be("profile.gender");
        (await CodeOf(await c.UpdateAsync(Upd(oath: "Forever")))).Should().Be("profile.oath");
    }

    [Fact]
    public async Task Oath_cannot_change_once_sworn()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        await c.UpdateAsync(Upd(oath: "Kinship"));
        (await CodeOf(await c.UpdateAsync(Upd(oath: "Bond")))).Should().Be("profile.oath_locked");
        (await c.MeAsync()).Profile!.OathSwornAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Bio_over_limit_is_400()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        (await c.UpdateAsync(Upd(bio: new string('a', 301)))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await c.UpdateAsync(Upd(bio: new string('a', 300)))).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Blank_name_is_400()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        (await c.CreateAsync("   ")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await c.CreateAsync(new string('x', 41))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_before_create_is_409()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        (await CodeOf(await c.UpdateAsync(Upd(bio: "hi")))).Should().Be("profile.missing");
    }

    [Fact]
    public async Task Update_publishes_profile_updated_to_own_account_only()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var a = await f.SignInAsync(vm);
        var b = await f.SignInAsync(vm);
        await f.As(a).CreateAsync();
        await using var la = await f.ListenAsync(a);
        await using var lb = await f.ListenAsync(b);
        await f.As(a).UpdateAsync(Upd(bio: "new"));
        (await la.WaitForAsync(LiveKinds.ProfileUpdated)).Should().NotBeNull();
        (await lb.WaitForAsync(LiveKinds.ProfileUpdated, TimeSpan.FromMilliseconds(400))).Should().BeNull();
    }

    [Fact]
    public async Task Suspended_account_gets_403_on_writes_but_can_read_me()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        await c.CreateAsync();
        await using (var scope = f.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<AppDb>().Set<Account>().Where(a => a.Id == s.AccountId)
                .ExecuteUpdateAsync(u => u.SetProperty(a => a.Status, AccountStatus.Suspended));
        var r = await c.UpdateAsync(Upd(bio: "x"));
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await CodeOf(r)).Should().Be("account.suspended");
        (await c.MeAsync()).Status.Should().Be("Suspended");
    }

    [Fact]
    public async Task Writes_over_rate_limit_get_429()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        f.WithSetting("RateLimits:WritesPerMinuteOverride", "3");
        var c = f.As(await f.SignInAsync(vm));
        await c.CreateAsync();
        var last = default(HttpResponseMessage);
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++) codes.Add((last = await c.UpdateAsync(Upd(bio: "b" + i))).StatusCode);
        codes.Should().Contain(HttpStatusCode.TooManyRequests);
        (await last!.Content.ReadFromJsonAsync<ErrorBody>())!.Code.Should().Be("rate_limited");
    }

    [Fact]
    public async Task Geo_cities_lists_provinces_districts_and_the_capital()
    {
        var (f, _, _) = Engine(db); await using var _f = f;
        var cities = await f.Client().GetFromJsonAsync<List<CityView>>("/geo/cities");
        cities!.Should().Contain(c => c.Name == "Ulaanbaatar" && c.Kind == "capital");
        cities.Count(c => c.Kind == "district").Should().Be(9);
        cities.Count(c => c.Kind == "province").Should().Be(21);
        cities.Should().OnlyContain(c => !string.IsNullOrEmpty(c.Region));
        cities.Should().Contain(c => c.Name == "Bayangol" && c.Region == "Ulaanbaatar");
        cities.Should().Contain(c => c.Name == "Erdenet" && c.Region == "Orkhon");
        cities.Where(c => c.Kind == "province").Select(c => c.Region).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task App_status_is_public_and_reflects_config()
    {
        var (f, _, _) = Engine(db); await using var _f = f;
        var s = await f.Client().GetFromJsonAsync<AppStatusView>("/app/status");
        s!.MinVersion.Should().Be("1.0.0");
        s.Maintenance.Should().BeFalse();
        s.PhotosMin.Should().Be(3);
        s.PhotosMax.Should().Be(6);
        s.FinishedPoints.Should().Be(50, "the welcome step shows what finishing pays");
    }

    [Fact]
    public async Task Locale_must_be_en_or_mn()
    {
        var (f, vm, _) = Engine(db); await using var _f = f;
        var c = f.As(await f.SignInAsync(vm));
        (await c.CreateAsync(locale: "fr")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        await c.CreateAsync(locale: "mn");
        (await c.MeAsync()).Profile!.Locale.Should().Be("mn");
    }
}
