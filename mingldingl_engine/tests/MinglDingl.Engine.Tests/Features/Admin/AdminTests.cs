using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Admin;

public class AdminTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<string?> Code(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ErrorBody>())?.Code;

    [Fact]
    public async Task Login_with_wrong_password_is_401()
    {
        await using var f = new EngineFactory(db);
        (await f.Client().LoginRawAsync("nope")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await f.Client().LoginRawAsync(username: "root")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Admin_token_is_rejected_on_app_endpoints()
    {
        await using var f = new EngineFactory(db);
        var admin = await f.AdminAsync();
        (await admin.GetAsync("/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task App_token_is_rejected_on_admin_endpoints()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var app = f.As(await f.SignInAsync(vm));
        (await app.GetAsync("/admin/users")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await f.Client().GetAsync("/admin/users")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public void Same_signing_keys_fail_startup()
    {
        using var f = new EngineFactory(db).WithSetting("Admin:JwtSigningKey", TestSettings.Defaults["Auth:SigningKey"]);
        var act = () => f.Client();
        act.Should().Throw<Exception>().Where(e => e.ToString().Contains("JwtSigningKey"));
    }

    [Fact]
    public async Task Login_throttles_after_5_failures()
    {
        await using var f = new EngineFactory(db);
        for (var i = 0; i < 5; i++) await f.Client().LoginRawAsync("wrong");
        var r = await f.Client().LoginRawAsync(); // even the right password waits
        r.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        // Its own code: "rate_limited" is the one-minute limit the app tells people about.
        (await Code(r)).Should().Be("admin.login_throttled");
        f.Clock.Advance(TimeSpan.FromMinutes(16));
        (await f.Client().LoginRawAsync()).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Admin_token_expires_after_12_hours()
    {
        await using var f = new EngineFactory(db);
        var admin = await f.AdminAsync();
        (await admin.GetAsync("/admin/config")).StatusCode.Should().Be(HttpStatusCode.OK);
        f.Clock.Advance(TimeSpan.FromHours(12.1));
        (await admin.GetAsync("/admin/config")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Users_list_pages_by_cursor_without_gaps_and_searches()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var made = new List<Guid>();
        for (var i = 0; i < 7; i++)
        {
            var s = await f.SignInAsync(vm);
            await f.As(s).CreateAsync("Name" + i);
            made.Add(s.AccountId);
            f.Clock.Advance(TimeSpan.FromSeconds(1));
        }
        var admin = await f.AdminAsync();
        var seen = new List<Guid>();
        string? cursor = null;
        do
        {
            var page = (await admin.GetFromJsonAsync<AdminUserPage>($"/admin/users?limit=3{(cursor is null ? "" : "&cursor=" + Uri.EscapeDataString(cursor))}"))!;
            page.Items.Count.Should().BeLessThanOrEqualTo(3);
            seen.AddRange(page.Items.Select(i => i.AccountId));
            cursor = page.NextCursor;
        } while (cursor is not null);
        seen.Should().OnlyHaveUniqueItems();
        seen.Should().Contain(made);
        seen.Take(7).Should().Equal(Enumerable.Reverse(made)); // newest first

        var found = (await admin.GetFromJsonAsync<AdminUserPage>("/admin/users?search=name3"))!;
        found.Items.Should().ContainSingle().Which.AccountId.Should().Be(made[3]);

        // An id finds exactly that person, with their standing; one with no profile yet has none.
        var byId = (await admin.GetFromJsonAsync<AdminUserPage>($"/admin/users?search={made[5]}"))!;
        var row = byId.Items.Should().ContainSingle().Which;
        row.AccountId.Should().Be(made[5]);
        row.Tier.Should().NotBeNull();
        row.Points.Should().NotBeNull();
        row.Reputation.Should().Be(100);
        var bare = await f.SignInAsync(vm);
        var none = (await admin.GetFromJsonAsync<AdminUserPage>($"/admin/users?search={bare.AccountId}"))!;
        none.Items.Should().ContainSingle().Which.Should().Match<AdminUserRow>(r => r.Tier == null && r.Points == null && r.Reputation == null);
    }

    [Fact]
    public async Task User_detail_shows_account_profile_photos_and_devices()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend(); f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm, device: "Galaxy A51");
        var c = f.As(s);
        await c.CreateAsync("Saruul");
        await c.UploadAsync();
        var admin = await f.AdminAsync();
        var d = (await admin.GetFromJsonAsync<AdminUserDetail>($"/admin/users/{s.AccountId}"))!;
        d.Profile!.Name.Should().Be("Saruul");
        d.Photos.Should().HaveCount(1);
        d.Devices.Should().ContainSingle().Which.DeviceName.Should().Be("Galaxy A51");
        (await admin.GetAsync($"/admin/users/{Guid.NewGuid()}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task New_signup_reaches_admin_hub_as_user_created()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var admin = await f.AdminAsync();
        await using var l = await f.ListenAsync(admin.AdminToken(), "/admin/live");
        var s = await f.SignInAsync(vm);
        (await l.WaitForAsync(LiveKinds.UserCreated))!.Ids.Should().Equal(s.AccountId);
        await f.As(s).CreateAsync();
        (await l.WaitForAsync(LiveKinds.UserUpdated)).Should().NotBeNull();
    }

    [Fact]
    public async Task App_token_cannot_join_admin_hub()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var s = await f.SignInAsync(vm);
        var act = () => f.ListenAsync(s.AccessToken, "/admin/live");
        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task Config_write_out_of_bounds_is_400_and_in_bounds_is_saved()
    {
        await using var f = new EngineFactory(db);
        var admin = await f.AdminAsync();
        var bad = await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.PhotosMax}", new ConfigWriteRequest("99"));
        bad.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Code(bad)).Should().Be("config.out_of_bounds");
        var ok = await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.WritesPerMinute}", new ConfigWriteRequest("40"));
        ok.StatusCode.Should().Be(HttpStatusCode.OK);
        var all = (await admin.GetFromJsonAsync<List<ConfigView>>("/admin/config"))!;
        all.Single(c => c.Key == ConfigKeys.WritesPerMinute).Value.Should().Be("40");
    }

    [Fact]
    public async Task Config_write_publishes_config_updated_to_app_clients()
    {
        await using var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
        var s = await f.SignInAsync(vm);
        await using var l = await f.ListenAsync(s);
        var admin = await f.AdminAsync();
        await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.AppMaintenance}", new ConfigWriteRequest("false"));
        (await l.WaitForAsync(LiveKinds.ConfigUpdated)).Should().NotBeNull();
    }

    [Fact]
    public async Task Config_write_publishes_config_updated_to_admins()
    {
        await using var f = new EngineFactory(db);
        var admin = await f.AdminAsync();
        await using var l = await f.ListenAsync(admin.AdminToken(), "/admin/live");
        await admin.PutAsJsonAsync($"/admin/config/{ConfigKeys.AppMaintenance}", new ConfigWriteRequest("false"));
        (await l.WaitForAsync(LiveKinds.ConfigUpdated)).Should().NotBeNull();
    }

    [Fact]
    public async Task Config_rows_carry_their_default()
    {
        await using var f = new EngineFactory(db);
        var admin = await f.AdminAsync();
        var all = (await admin.GetFromJsonAsync<List<ConfigView>>("/admin/config"))!;
        all.Single(c => c.Key == ConfigKeys.PhotosMin).Default.Should().Be("3");
    }
}
