using MinglDingl.Engine.Features.Video;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Venues;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Dev;
using MinglDingl.Engine.Kernel.Maintenance;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Push;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Kernel.Push;
using MinglDingl.Engine.Kernel.Storage;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.RateLimits;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine;

/// The one place every service is registered.
public static class Registration
{
    public static IServiceCollection AddEngine(this IServiceCollection s, IConfiguration config, IHostEnvironment env)
    {
        s.AddRateLimits(config);

        // Auth
        if (config.GetValue<bool>("WeSend:Fake"))
        {
            if (!env.IsDevelopment())
                throw new InvalidOperationException("WeSend:Fake is only allowed in Development");
            s.AddSingleton<IWeSend, FakeWeSend>();
        }
        else
        {
            s.AddHttpClient<WeSendClient>(c =>
            {
                c.BaseAddress = new Uri((config["WeSend:BaseUrl"] ?? "https://api.wesend.mn").TrimEnd('/') + "/");
                c.DefaultRequestHeaders.Authorization = new("Bearer", config["WeSend:ApiKey"]);
                c.Timeout = TimeSpan.FromSeconds(10);
            });
            if (config["Review:Phone"] is { Length: > 0 } reviewPhone)
            {
                if (config["Review:Code"] is not { Length: 6 } reviewCode || !reviewCode.All(char.IsAsciiDigit))
                    throw new InvalidOperationException("Review:Phone needs a six-digit Review:Code");
                s.AddTransient<IWeSend>(sp => new ReviewWeSend(sp.GetRequiredService<WeSendClient>(), reviewPhone, reviewCode));
            }
            else s.AddTransient<IWeSend>(sp => sp.GetRequiredService<WeSendClient>());
        }
        s.AddScoped<PhoneVerificationService>();
        s.AddScoped<SessionService>();
        s.AddScoped<AccountService>();
        s.AddSingleton<TokenIssuer>();
        s.AddMemoryCache();
        var keys = s.AddDataProtection().SetApplicationName("mingldingl-engine");
        if (config["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
            keys.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        s.AddAppAuthentication(config);

        // Score
        s.AddScoped<ScoreService>();
        s.AddSingleton<IEndpointModule, ScoreEndpoints>();

        // Profile
        s.AddScoped<ProfileService>();
        s.AddScoped<DeepProfileService>();
        s.AddSingleton<IEndpointModule, DeepProfileEndpoints>();
        s.AddSingleton<IEndpointModule, ProfileEndpoints>();

        // Photos
        s.AddHttpClient<IPhotoStore, SupabasePhotoStore>(c =>
        {
            c.BaseAddress = new Uri((config["Supabase:ProjectUrl"] ?? "http://localhost").TrimEnd('/') + "/storage/v1/");
            c.DefaultRequestHeaders.Authorization = new("Bearer", config["Supabase:SecretKey"]);
            c.DefaultRequestHeaders.Add("apikey", config["Supabase:SecretKey"]);
            c.Timeout = TimeSpan.FromSeconds(30);
        });
        s.AddSingleton<SignedUrlCache>();
        s.AddScoped<PhotoService>();
        s.AddScoped<FaceProofService>();
        s.AddSingleton<IEndpointModule, PhotoEndpoints>();

        // Bonds, Seek, Safety
        s.AddScoped<BondService>();
        s.AddSingleton<IEndpointModule, BondEndpoints>();
        s.AddScoped<AwayService>();
        s.AddScoped<Features.Wanderings.WanderingService>();
        s.AddSingleton<IEndpointModule, Features.Wanderings.WanderingEndpoints>();
        s.AddSingleton<IEndpointModule, AwayEndpoints>();
        s.AddSingleton<BondSweep>();
        s.AddHostedService(sp => sp.GetRequiredService<BondSweep>());
        s.AddScoped<SeekService>();
        s.AddSingleton<IEndpointModule, SeekEndpoints>();
        s.AddScoped<SafetyService>();
        s.AddSingleton<IEndpointModule, SafetyEndpoints>();

        // Venues, Encounters
        s.AddScoped<VenueService>();
        s.AddScoped<Features.Codex.CodexService>();
        s.AddSingleton<IEndpointModule, Features.Codex.CodexEndpoints>();
        s.AddSingleton<IEndpointModule, VenueEndpoints>();
        s.AddScoped<EncounterService>();
        s.AddScoped<MeetingService>();
        s.AddSingleton<IEndpointModule, EncounterEndpoints>();

        // The road (stage 5a)
        s.AddScoped<Features.Festivals.FestivalService>();
        s.AddScoped<Features.Honours.HonourService>();
        s.AddScoped<Features.Quests.QuestService>();
        s.AddScoped<Features.Hall.HallService>();
        s.AddSingleton<IEndpointModule, Features.Honours.WorldEndpoints>();
        s.AddScoped<Features.Campaign.CampaignService>();
        s.AddScoped<Features.Campaign.WeeklyTrialService>();
        s.AddSingleton<IEndpointModule, Features.Campaign.CampaignEndpoints>();
        s.AddScoped<Features.Threads.ThreadService>();
        s.AddSingleton<IEndpointModule, Features.Threads.ThreadEndpoints>();
        s.AddScoped<Features.Admin.AdminWorld>();
        s.AddScoped<Features.Square.SquareService>();
        s.AddSingleton<IEndpointModule, Features.Square.SquareEndpoints>();
        s.AddSingleton<Features.Square.SquareClock>();
        s.AddHostedService(sp => sp.GetRequiredService<Features.Square.SquareClock>());

        // Membership & payments (stage 6a)
        s.AddScoped<Features.Membership.MembershipService>();
        s.AddScoped<Features.Payments.PaymentService>();
        s.AddSingleton<Features.Payments.GuildAuth>();
        s.AddSingleton<IEndpointModule, Features.Payments.PaymentEndpoints>();
        s.AddSingleton<Features.Payments.PaymentSweep>();
        s.AddHostedService(sp => sp.GetRequiredService<Features.Payments.PaymentSweep>());
        s.AddSingleton(new Features.Payments.RevenueCatSettings
        {
            SecretKey = config["RevenueCat:SecretKey"] ?? "", WebhookAuth = config["RevenueCat:WebhookAuth"] ?? "",
        });
        var devLike = env.IsDevelopment() || env.IsEnvironment("Testing");
        if (config.GetValue<bool>("QPay:Fake"))
        {
            if (!devLike) throw new InvalidOperationException("QPay:Fake is only allowed in Development");
            s.AddSingleton<Features.Payments.FakeQPay>();
            s.AddSingleton<Features.Payments.IQPay>(sp => sp.GetRequiredService<Features.Payments.FakeQPay>());
        }
        else
        {
            var qpay = new Features.Payments.QPaySettings
            {
                ClientId = config["QPay:ClientId"] ?? "", ClientSecret = config["QPay:ClientSecret"] ?? "",
                InvoiceCode = config["QPay:InvoiceCode"] ?? "", CallbackBase = config["QPay:CallbackBase"] ?? "",
            };
            // Without a merchant account the web page cannot make an invoice (503), so nothing can be paid.
            if (qpay.ClientId.Length == 0 || qpay.ClientSecret.Length == 0 || qpay.InvoiceCode.Length == 0 || qpay.CallbackBase.Length == 0)
                s.AddSingleton<Features.Payments.IQPay, Features.Payments.QPayUnavailable>();
            else
            {
                s.AddSingleton(qpay);
                s.AddSingleton<Features.Payments.QPayTokens>();
                s.AddHttpClient<Features.Payments.IQPay, Features.Payments.QPayClient>(c =>
                {
                    c.BaseAddress = new Uri((config["QPay:BaseUrl"] ?? "https://merchant.qpay.mn/v2").TrimEnd('/') + "/");
                    c.Timeout = TimeSpan.FromSeconds(20);
                });
            }
        }
        if (config.GetValue<bool>("RevenueCat:Fake"))
        {
            if (!devLike) throw new InvalidOperationException("RevenueCat:Fake is only allowed in Development");
            s.AddSingleton<Features.Payments.FakeRevenueCat>();
            s.AddSingleton<Features.Payments.IRevenueCat>(sp => sp.GetRequiredService<Features.Payments.FakeRevenueCat>());
        }
        else
        {
            s.AddHttpClient<Features.Payments.IRevenueCat, Features.Payments.RevenueCatClient>(c =>
            {
                c.BaseAddress = new Uri((config["RevenueCat:BaseUrl"] ?? "https://api.revenuecat.com/v1").TrimEnd('/') + "/");
                c.DefaultRequestHeaders.Authorization = new("Bearer", config["RevenueCat:SecretKey"]);
                c.Timeout = TimeSpan.FromSeconds(15);
            });
        }

        // Statistics & the engine room (stage 6c)
        s.AddSingleton<Features.Stats.OpsClock>();
        s.AddScoped<Features.Stats.StatsService>();
        s.AddScoped<Features.Stats.StatsTables>();
        s.AddSingleton<IEndpointModule, Features.Stats.StatsEndpoints>();
        s.AddSingleton<Features.Stats.StatsSweep>();
        s.AddHostedService(sp => sp.GetRequiredService<Features.Stats.StatsSweep>());
        s.AddHttpClient();

        // Video (the Flame Rite)
        s.AddSingleton(new AgoraSettings(config["Agora:AppId"], config["Agora:AppCertificate"], config["Agora:NcsSecret"],
            env.IsDevelopment() || env.IsEnvironment("Testing")));
        s.AddScoped<VideoService>();
        s.AddSingleton<IEndpointModule, VideoEndpoints>();

        // Push: held until commit like live events, sent off the request path
        s.AddSingleton<PushQueue>();
        s.AddScoped<PushOutbox>();
        s.AddScoped<IPushOutbox>(sp => sp.GetRequiredService<PushOutbox>());
        s.AddScoped<PushTokens>();
        s.AddHttpClient<IPushGateway, ExpoPushGateway>(c =>
        {
            c.BaseAddress = new Uri((config["Push:ExpoUrl"] ?? "https://exp.host/--/api/v2").TrimEnd('/') + "/");
            if (config["Push:ExpoAccessToken"] is { Length: > 0 } token) c.DefaultRequestHeaders.Authorization = new("Bearer", token);
            c.Timeout = TimeSpan.FromSeconds(15);
        });
        s.AddSingleton<PushSender>();
        s.AddHostedService(sp => sp.GetRequiredService<PushSender>());
        s.AddSingleton<IEndpointModule, PushEndpoints>();

        // Admin
        s.AddSingleton<AdminAuth>();
        s.AddScoped<AdminUsers>();
        s.AddScoped<AdminHand>();
        s.AddSingleton<IEndpointModule, AdminEndpoints>();

        // Maintenance
        s.AddSingleton<DailySweep>();
        s.AddHostedService(sp => sp.GetRequiredService<DailySweep>());

        // Dev tools — never outside Development (the test host counts as Development here)
        if (env.IsDevelopment() || env.IsEnvironment("Testing"))
        {
            s.AddScoped<DevSeeder>();
            s.AddScoped<CrowdSeeder>();
            s.AddScoped<WorldSeeder>();
            s.AddSingleton<IEndpointModule, DevEndpoints>();
        }

        // Forwarded headers: only from proxies named in config, so per-IP limits see the real client
        s.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            foreach (var p in CorsOrigins.Parse(config["ForwardedHeaders:KnownProxies"], []))
                if (System.Net.IPAddress.TryParse(p, out var ip)) o.KnownProxies.Add(ip);
            foreach (var n in CorsOrigins.Parse(config["ForwardedHeaders:KnownNetworks"], []))
                if (System.Net.IPNetwork.TryParse(n, out var net)) o.KnownIPNetworks.Add(net);
        });

        // CORS: required outside Development; permissive (no credentials) in dev when unset
        var origins = CorsOrigins.Parse(config["Cors:AllowedOrigins"], config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? []);
        if (origins.Length == 0 && !(env.IsDevelopment() || env.IsEnvironment("Testing")))
            throw new InvalidOperationException("Cors:AllowedOrigins must be set outside Development");
        s.AddCors(o => o.AddDefaultPolicy(p =>
        {
            if (origins.Length == 0) p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            else p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }));
        s.AddValidation();
        s.AddSingleton<IEndpointModule, AuthEndpoints>();

        s.AddSingleton<IClock, SystemClock>();
        s.AddSingleton<IConfig, ConfigService>();
        s.AddScoped<ConfigWrites>();
        s.AddSignalR();
        s.AddHttpContextAccessor();
        s.AddScoped<LiveOutbox>();
        s.AddScoped<ILiveOutbox>(sp => sp.GetRequiredService<LiveOutbox>());
        s.AddScoped<LiveFlushInterceptor>();
        s.AddScoped<Features.Honours.HonourTouches>();
        s.AddScoped<Features.Honours.HonourWatch>();
        // Live events go out first; then honours are checked for whoever the write touched.
        s.AddDbContext<AppDb>((sp, o) => o
            .UseNpgsql(config.GetConnectionString("Default"))
            .AddInterceptors(sp.GetRequiredService<LiveFlushInterceptor>(), sp.GetRequiredService<Features.Honours.HonourWatch>()));
        // Numbers are numbers: the web default also accepts "7", which types every int as int|string for clients.
        s.ConfigureHttpJsonOptions(o => o.SerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.Strict);
        s.AddOpenApi(o => o.AddDocumentTransformer((doc, _, _) =>
        {
            doc.Servers = [];   // the export runs on a random port; the doc must not depend on it
            doc.Info.Title = "MingldIngl Engine";
            return Task.CompletedTask;
        }));
        return s;
    }

    private static void AddAppAuthentication(this IServiceCollection s, IConfiguration config)
    {
        // Fail at boot, not at the first request, when a key is missing, short or shared.
        _ = TokenIssuer.Key(config);
        _ = AdminAuth.Key(config);

        var auth = s.AddAuthentication(AppClaims.Scheme);
        auth.AddJwtBearer(AppClaims.Scheme, o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = AppClaims.Issuer,
                    ValidAudience = AppClaims.Issuer,
                    IssuerSigningKey = TokenIssuer.Key(config),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = AppClaims.Sub,
                    // Lifetime is checked against the engine clock (below), so tests can move time.
                    ValidateLifetime = false,
                };
                o.Events = new JwtBearerEvents
                {
                    // WebSockets cannot carry headers: the hub's token arrives in the query string.
                    OnMessageReceived = ctx =>
                    {
                        if (ctx.HttpContext.Request.Path.StartsWithSegments("/live") && ctx.Request.Query.TryGetValue("access_token", out var t))
                            ctx.Token = t;
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = async ctx =>
                    {
                        var sp = ctx.HttpContext.RequestServices;
                        var now = sp.GetRequiredService<IClock>().UtcNow;
                        var exp = ctx.SecurityToken.ValidTo;
                        if (exp == DateTime.MinValue || now.UtcDateTime >= exp) { ctx.Fail("expired"); return; }
                        var sid = ctx.Principal!.SessionId();
                        if (await SessionService.IsRevokedAsync(sp.GetRequiredService<AppDb>(), sp.GetRequiredService<IMemoryCache>(), sid, ctx.HttpContext.RequestAborted))
                            ctx.Fail("revoked");
                    },
                };
            });
        auth.AddJwtBearer(AdminAuth.Scheme, o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = AdminAuth.Issuer,
                ValidAudience = AdminAuth.Issuer,
                IssuerSigningKey = AdminAuth.Key(config),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                ValidateLifetime = false,
            };
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    if (ctx.HttpContext.Request.Path.StartsWithSegments("/admin/live") && ctx.Request.Query.TryGetValue("access_token", out var t))
                        ctx.Token = t;
                    return Task.CompletedTask;
                },
                OnTokenValidated = ctx =>
                {
                    var now = ctx.HttpContext.RequestServices.GetRequiredService<IClock>().UtcNow;
                    if (now.UtcDateTime >= ctx.SecurityToken.ValidTo) ctx.Fail("expired");
                    return Task.CompletedTask;
                },
            };
        });
        auth.AddJwtBearer(Features.Payments.GuildAuth.Scheme, o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = Features.Payments.GuildAuth.Issuer,
                ValidAudience = Features.Payments.GuildAuth.Issuer,
                IssuerSigningKey = Features.Payments.GuildAuth.Key(config),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                NameClaimType = AppClaims.Sub,
                ValidateLifetime = false,
            };
            o.Events = new JwtBearerEvents
            {
                OnTokenValidated = ctx =>
                {
                    var now = ctx.HttpContext.RequestServices.GetRequiredService<IClock>().UtcNow;
                    if (now.UtcDateTime >= ctx.SecurityToken.ValidTo) ctx.Fail("expired");
                    return Task.CompletedTask;
                },
            };
        });
        s.AddAuthorization(o =>
        {
            o.AddPolicy(AdminEndpoints.Policy, p => p
                .AddAuthenticationSchemes(AdminAuth.Scheme)
                .RequireAuthenticatedUser()
                .RequireClaim("role", "admin"));
            o.AddPolicy(Features.Payments.GuildAuth.Policy, p => p
                .AddAuthenticationSchemes(Features.Payments.GuildAuth.Scheme)
                .RequireAuthenticatedUser());
        });
    }
}
