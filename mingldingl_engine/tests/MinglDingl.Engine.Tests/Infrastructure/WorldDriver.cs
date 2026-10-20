using System.Collections.Concurrent;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Push;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Kernel.Errors;
using static MinglDingl.Engine.Tests.Infrastructure.ProfileDriver;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// Records pushes instead of calling Expo.
public sealed class RecordingPushGateway : IPushGateway
{
    public ConcurrentQueue<PushMessage> Sent { get; } = new();

    public Task SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default)
    {
        foreach (var m in messages) Sent.Enqueue(m);
        return Task.CompletedTask;
    }

    public async Task<PushMessage?> WaitForAsync(Func<PushMessage, bool> match, TimeSpan? timeout = null)
    {
        var until = DateTimeOffset.UtcNow + (timeout ?? TimeSpan.FromSeconds(3));
        while (DateTimeOffset.UtcNow < until)
        {
            var hit = Sent.FirstOrDefault(match);
            if (hit is not null) return hit;
            await Task.Delay(25);
        }
        return null;
    }
}

/// A test world: its own database, an engine with scripted WeSend, memory photo storage and a
/// push recorder. Seek sees everyone in the database, so worlds never share one.
public sealed class World : IAsyncDisposable
{
    /// campaign: the Campaign's chamber points stay on (off by default, so earlier stages' point sums hold).
    public static async Task<World> CreateAsync(PostgresFixture db, Action<EngineFactory>? configure = null, bool campaign = false)
    {
        var cs = await db.FreshDatabaseAsync();
        var w = new World(db, f => { f.WithSetting("ConnectionStrings:Default", cs); configure?.Invoke(f); });
        if (!campaign)
        {
            await w.SetAsync(MinglDingl.Engine.Kernel.Config.ConfigKeys.ScoreCampaignRoom, "0");
            await w.SetAsync(MinglDingl.Engine.Kernel.Config.ConfigKeys.ScoreCampaignBoss, "0");
        }
        // Earlier stages ring a bell and sit at once; the High Table's lead is tested on its own.
        await w.SetAsync(MinglDingl.Engine.Kernel.Config.ConfigKeys.SquareHighTableLeadMinutes, "0");
        return w;
    }

    public EngineFactory F { get; }
    public ScriptedWeSend Vm { get; }
    public RecordingPushGateway Push { get; } = new();

    public World(PostgresFixture db, Action<EngineFactory>? configure = null)
    {
        F = new EngineFactory(db);
        Vm = F.UseScriptedWeSend();
        F.UseMemoryPhotoStore();
        F.WithServices(s => { s.RemoveAll<IPushGateway>(); s.AddSingleton<IPushGateway>(Push); });
        F.WithServices(s =>
        {
            s.RemoveAll<MinglDingl.Engine.Features.Payments.IQPay>();
            s.AddSingleton<MinglDingl.Engine.Features.Payments.FakeQPay>();
            s.AddSingleton<MinglDingl.Engine.Features.Payments.IQPay>(sp => sp.GetRequiredService<MinglDingl.Engine.Features.Payments.FakeQPay>());
            s.RemoveAll<MinglDingl.Engine.Features.Payments.IRevenueCat>();
            s.AddSingleton<MinglDingl.Engine.Features.Payments.FakeRevenueCat>();
            s.AddSingleton<MinglDingl.Engine.Features.Payments.IRevenueCat>(sp => sp.GetRequiredService<MinglDingl.Engine.Features.Payments.FakeRevenueCat>());
        });
        F.WithSetting("RateLimits:WritesPerMinuteOverride", "100000");
        configure?.Invoke(F);
    }

    public sealed record Person(HttpClient C, SessionPair S, Guid Id, string Name);

    private readonly List<Person> _people = [];

    /// Moves time on and keeps everyone signed in (an access token lives 15 minutes).
    public async Task AdvanceAsync(TimeSpan by)
    {
        F.Clock.Advance(by);
        foreach (var p in _people)
        {
            var r = await F.Client().RefreshRawAsync(p.C.RefreshToken());
            r.EnsureSuccessStatusCode();
            var pair = (await r.Content.ReadFromJsonAsync<SessionPair>())!;
            p.C.DefaultRequestHeaders.Authorization = new("Bearer", pair.AccessToken);
            p.C.DefaultRequestHeaders.Remove("X-Test-Refresh");
            p.C.DefaultRequestHeaders.Add("X-Test-Refresh", pair.RefreshToken);
        }
    }

    /// A finished character with three portraits.
    public async Task<Person> PersonAsync(string name, string gender, string city = "Bayangol", string oath = "Bond", int photos = 3,
        string? phone = null, string? allyCode = null, string? deviceKey = null)
    {
        var s = await F.SignInAsync(Vm, phone, allyCode: allyCode, deviceKey: deviceKey);
        var c = F.As(s);
        (await c.CreateAsync(name)).EnsureSuccessStatusCode();
        (await c.UpdateAsync(Upd(gender: gender, bio: $"{name}'s tale", city: city))).EnsureSuccessStatusCode();
        for (var i = 0; i < photos; i++) await c.UploadAsync(); // photo-3, the fixture that shows a face
        (await c.UpdateAsync(Upd(oath: oath))).EnsureSuccessStatusCode();
        (await c.UpdateAsync(Upd(welcomed: true))).EnsureSuccessStatusCode();
        var me = await c.MeAsync();
        me.OnboardingStep.Should().Be(7);
        var person = new Person(c, s, me.AccountId, name);
        _people.Add(person);
        return person;
    }

    public async Task SetAsync(string key, string value)
    {
        await using var scope = F.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<MinglDingl.Engine.Kernel.Config.ConfigWrites>().SetAsync(key, value);
    }

    public async Task SweepAsync()
    {
        await F.Services.GetRequiredService<BondSweep>().RunAsync();
    }

    public ValueTask DisposeAsync() => F.DisposeAsync();
}

public static class WorldDriver
{
    public static async Task<string?> CodeOf(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ErrorBody>())?.Code;

    public static async Task<SeekView> SeekAsync(this HttpClient c) => (await c.GetFromJsonAsync<SeekView>("/seek"))!;

    public static Task<HttpResponseMessage> SummonRawAsync(this HttpClient c, Guid id) => c.PostAsync($"/seek/{id}/summon", null);

    public static async Task<BondView> SummonAsync(this HttpClient c, Guid id)
    {
        var r = await c.SummonRawAsync(id);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<BondView>())!;
    }

    public static async Task<BondView> BondAsync(this HttpClient c, Guid id) => (await c.GetFromJsonAsync<BondView>($"/bonds/{id}"))!;
    public static async Task<List<BondRow>> BondsAsync(this HttpClient c) => (await c.GetFromJsonAsync<List<BondRow>>("/bonds"))!;

    public static Task<HttpResponseMessage> WriteRawAsync(this HttpClient c, Guid bond, string text) =>
        c.PostAsJsonAsync($"/bonds/{bond}/letters", new WriteLetterRequest(text));

    public static async Task<LetterView> WriteAsync(this HttpClient c, Guid bond, string text = "Hello")
    {
        var r = await c.WriteRawAsync(bond, text);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<LetterView>())!;
    }

    /// n letters each, alternating, starting with `first`.
    public static async Task ExchangeAsync(Guid bond, HttpClient first, HttpClient second, int n)
    {
        for (var i = 0; i < n; i++)
        {
            await first.WriteAsync(bond, $"a{i}");
            await second.WriteAsync(bond, $"b{i}");
        }
    }

    public static async Task<int> PointsAsync(this HttpClient c) => (await c.MeAsync()).Profile!.Points;
}
