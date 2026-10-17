using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Tests.Infrastructure;

public sealed class EngineFactory(PostgresFixture db) : WebApplicationFactory<Program>
{
    private readonly List<Action<IEndpointRouteBuilder>> _extraEndpoints = [];
    private readonly Dictionary<string, string?> _settings = new();
    private readonly List<Action<IServiceCollection>> _services = [];

    public TestClock Clock { get; } = new();

    public EngineFactory WithEndpoint(string path, Delegate handler)
    {
        _extraEndpoints.Add(e => e.MapGet(path, handler));
        return this;
    }

    private string _environment = "Testing";
    public EngineFactory WithEnvironment(string env) { _environment = env; return this; }

    public EngineFactory WithSetting(string key, string? value) { _settings[key] = value; return this; }

    public EngineFactory WithServices(Action<IServiceCollection> configure) { _services.Add(configure); return this; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(_environment);
        builder.UseSetting("ConnectionStrings:Default", db.ConnectionString);
        foreach (var (k, v) in TestSettings.Defaults) builder.UseSetting(k, v);
        foreach (var (k, v) in _settings) builder.UseSetting(k, v);
        builder.ConfigureServices(s =>
        {
            s.RemoveAll<IClock>();
            s.AddSingleton<IClock>(Clock);
            foreach (var e in _extraEndpoints) s.AddSingleton<IEndpointModule>(new DelegateModule(e));
            foreach (var c in _services) c(s);
        });
    }

    public HttpClient Client() => CreateClient();

    private sealed class DelegateModule(Action<IEndpointRouteBuilder> map) : IEndpointModule
    {
        public void Map(IEndpointRouteBuilder app) => map(app);
    }
}

public static class TestSettings
{
    public static readonly IReadOnlyDictionary<string, string?> Defaults = new Dictionary<string, string?>
    {
        ["Auth:SigningKey"] = "test-app-signing-key-0123456789-abcdefghij",
        ["Admin:JwtSigningKey"] = "test-admin-signing-key-0123456789-abcdefgh",
        ["Admin:Username"] = "admin",
        ["Admin:PasswordHash"] = MinglDingl.Engine.Features.Admin.AdminPasswordHasher.Hash(AdminDriver.Password),
        ["VerifyMn:Fake"] = "false",
        ["RateLimits:AuthPerMinute"] = "1000",
        ["RateLimits:AdminLoginPer15Min"] = "5",
        // Outside Development the engine will not start with video on and Agora unset.
        ["Agora:AppId"] = "test-agora-app-id",
        ["Agora:AppCertificate"] = "test-agora-certificate",
        ["Agora:NcsSecret"] = "test-ncs-secret",
        // Real-shaped settings so every environment starts; the World swaps in the fakes.
        ["QPay:ClientId"] = "test-qpay",
        ["QPay:ClientSecret"] = "test-qpay-secret",
        ["QPay:InvoiceCode"] = "TEST_INVOICE",
        ["QPay:CallbackBase"] = "http://localhost",
        ["RevenueCat:WebhookAuth"] = "Bearer test-revenuecat-hook",
    };
}
