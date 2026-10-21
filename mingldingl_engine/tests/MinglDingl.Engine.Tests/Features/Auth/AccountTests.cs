using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Storage;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Auth;

/// The War Room's account rows: pause, abandon / keep / burn, the sigil move, and the Codex.
public class AccountTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static UpdateProfileRequest Pause(bool on) => new(null, null, null, null, null, null, null, on);

    [Fact]
    public async Task A_paused_character_leaves_Seek_and_its_bonds_go_on()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var oyun = await w.PersonAsync("Oyun", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);

        (await saruul.C.UpdateAsync(Pause(true))).EnsureSuccessStatusCode();
        (await oyun.C.UpdateAsync(Pause(true))).EnsureSuccessStatusCode();
        (await saruul.C.MeAsync()).Profile!.Paused.Should().BeTrue();
        (await bat.C.SeekAsync()).Candidate.Should().BeNull();
        await saruul.C.WriteAsync(bond.Id, "Still here");

        (await oyun.C.UpdateAsync(Pause(false))).EnsureSuccessStatusCode();
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(oyun.Id);
    }

    [Fact]
    public async Task Abandon_hides_the_character_and_keep_or_a_sign_in_undoes_it()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");

        (await saruul.C.PostAsync("/me/abandon", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        var me = await saruul.C.MeAsync();
        me.DeleteAt.Should().BeCloseTo(w.F.Clock.UtcNow.AddDays(30), TimeSpan.FromSeconds(1));
        (await bat.C.SeekAsync()).Candidate.Should().BeNull();

        (await saruul.C.PostAsync("/me/keep", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await saruul.C.MeAsync()).DeleteAt.Should().BeNull();
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(saruul.Id);

        (await saruul.C.PostAsync("/me/abandon", null)).EnsureSuccessStatusCode();
        string phone;
        await using (var scope = w.F.Services.CreateAsyncScope())
            phone = await scope.ServiceProvider.GetRequiredService<AppDb>().Set<Account>()
                .Where(a => a.Id == saruul.Id).Select(a => a.Phone).SingleAsync();
        var again = await w.F.SignInAsync(w.Vm, phone, "second-phone");
        again.AccountId.Should().Be(saruul.Id);
        (await saruul.C.MeAsync()).DeleteAt.Should().BeNull();
    }

    [Fact]
    public async Task On_its_day_an_abandoned_character_burns_with_its_portraits_and_the_number_is_free()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = await bat.C.SummonAsync(saruul.Id);
        await bat.C.WriteAsync(bond.Id);
        var files = (MemoryPhotoStore)w.F.Services.GetRequiredService<IPhotoStore>();
        files.Files.Keys.Count(k => k.StartsWith(saruul.Id.ToString())).Should().Be(3);

        (await saruul.C.PostAsync("/me/abandon", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromDays(29));
        await w.F.DailySweepAsync();
        (await saruul.C.MeAsync()).DeleteAt.Should().NotBeNull();

        w.F.Clock.Advance(TimeSpan.FromDays(2));
        await w.F.DailySweepAsync();
        await using (var scope = w.F.Services.CreateAsyncScope())
            (await scope.ServiceProvider.GetRequiredService<AppDb>().Set<Account>().AnyAsync(a => a.Id == saruul.Id))
                .Should().BeFalse();
        files.Files.Keys.Should().NotContain(k => k.StartsWith(saruul.Id.ToString()));
        var r = await w.F.Client().RefreshRawAsync(bat.C.RefreshToken());
        var pair = (await r.Content.ReadFromJsonAsync<SessionPair>())!;
        bat.C.DefaultRequestHeaders.Authorization = new("Bearer", pair.AccessToken);
        (await bat.C.BondsAsync()).Should().BeEmpty();
    }

    [Fact]
    public async Task The_sigil_moves_to_a_proven_number_and_signs_out_the_other_devices()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var oyun = await w.PersonAsync("Oyun", "Female");
        string oldPhone, oyunPhone;
        await using (var scope = w.F.Services.CreateAsyncScope())
        {
            var accounts = scope.ServiceProvider.GetRequiredService<AppDb>().Set<Account>();
            oldPhone = await accounts.Where(a => a.Id == bat.Id).Select(a => a.Phone).SingleAsync();
            oyunPhone = await accounts.Where(a => a.Id == oyun.Id).Select(a => a.Phone).SingleAsync();
        }
        var tablet = await w.F.SignInAsync(w.Vm, oldPhone, "tablet");

        var taken = await bat.C.PostAsJsonAsync("/me/sigil/start", new SigilStartRequest(oyunPhone, null));
        taken.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(taken)).Should().Be("auth.phone_taken");
        (await CodeOf(await bat.C.PostAsJsonAsync("/me/sigil/start", new SigilStartRequest(oldPhone, null))))
            .Should().Be("auth.same_phone");

        var fresh = SessionDriver.NewPhone();
        var start = await bat.C.PostAsJsonAsync("/me/sigil/start", new SigilStartRequest(fresh, null));
        var s = (await start.Content.ReadFromJsonAsync<StartResponse>())!;
        (await CodeOf(await bat.C.PostAsJsonAsync("/me/sigil/complete", new SigilCompleteRequest(s.VerificationId))))
            .Should().Be("auth.not_verified");
        await bat.C.CheckAsync(w.Vm, s.VerificationId);
        (await bat.C.PostAsJsonAsync("/me/sigil/complete", new SigilCompleteRequest(s.VerificationId)))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await bat.C.MeAsync()).PhoneHint.Should().Be(fresh[..4]);
        (await w.F.Client().RefreshRawAsync(tablet.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await w.F.SignInAsync(w.Vm, fresh, "new-phone")).AccountId.Should().Be(bat.Id);
        // The old number is free: proving it now makes a new account.
        (await w.F.SignInAsync(w.Vm, oldPhone, "someone")).AccountId.Should().NotBe(bat.Id);
    }

    [Fact]
    public async Task The_Codex_reads_in_order_and_falls_back_to_English()
    {
        await using var w = await World.CreateAsync(db);
        var c = w.F.Client();
        var pages = (await c.GetFromJsonAsync<List<CodexPageView>>("/codex?locale=mn"))!;
        pages.Select(p => p.Slug).Should().Equal(CodexSeed.Pages.Select(p => p.Slug));
        pages[0].Kind.Should().Be("guide");
        pages[^1].Kind.Should().Be("legal");
        (await c.GetFromJsonAsync<CodexPageView>("/codex/fire"))!.Body.Should().StartWith("When someone writes to you");
        (await c.GetAsync("/codex/nowhere")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
