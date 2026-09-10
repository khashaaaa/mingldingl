using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Threading.RateLimiting;

if (args.Length > 0 && args[0] == "hash-password")
{
    if (args.Length < 2)
    {
        Console.WriteLine("Usage: dotnet run -- hash-password <password>");
        return;
    }
    Console.WriteLine(AdminPasswordHasher.Hash(args[1]));
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<ApiBehaviorOptions>(opt =>
{
    opt.InvalidModelStateResponseFactory = context => ModelValidationResponse.For(context.ModelState);
});

var dataSourceBuilder = new NpgsqlDataSourceBuilder(builder.Configuration.GetConnectionString("DefaultConnection"));
dataSourceBuilder.EnableDynamicJson();
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(dataSource, npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3)));

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", opt =>
    {
        opt.Authority = builder.Configuration["Supabase:ProjectUrl"] + "/auth/v1";
        opt.RequireHttpsMetadata = true;
        opt.MapInboundClaims = false;
        opt.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    })

    .AddJwtBearer("AdminBearer", opt =>
    {
        var signingKey = builder.Configuration["Admin:JwtSigningKey"];
        opt.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = string.IsNullOrEmpty(signingKey)
                ? null
                : new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddApplicationServices();

// Per-IP budget on POST /auth/phone/start only — bounds provider-quota burn across many distinct
// numbers from one source. Deliberately not a global limiter: the app polls
// GET /auth/phone/status/{id} on a timer for the whole duration of every verification, and a
// global cap would break that poll for every real user. See PhoneStartRateLimit for the reasoning
// behind the window/permit numbers (legitimate retry/resume traffic and mobile-carrier NAT).
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, ct) =>
    {
        // Same body shape as PhoneVerificationService's per-number 429
        // (phone.too_many_attempts) so the app needs no new error-handling branch, but a
        // distinguishable code so the two causes can be told apart in logs and by the client.
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ErrorResponse(
                "Too many verification attempts from this network; wait a few minutes before trying again",
                "phone.too_many_attempts_ip"),
            ct);
    };

    options.AddPolicy(PhoneStartRateLimit.PolicyName, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = PhoneStartRateLimit.PermitLimit,
                Window = PhoneStartRateLimit.Window,
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});
var allowedOrigins = CorsOrigins.Parse(builder.Configuration);
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
{
    p.AllowAnyHeader().AllowAnyMethod();
    if (allowedOrigins is { Length: > 0 })
        p.WithOrigins(allowedOrigins).AllowCredentials();
    else if (builder.Environment.IsDevelopment())
        // Expo web, Vite, and LAN device testing all vary by port, so dev stays permissive —
        // but without credentials, so a stray origin still cannot ride an authenticated session.
        p.SetIsOriginAllowed(_ => true);
    else
        throw new InvalidOperationException(
            "Cors:AllowedOrigins must be configured outside Development.");
}));

// Refuse to boot instead of failing open, the way Cors:AllowedOrigins already does above.
StartupGuards.RequireProductionConfig(builder.Configuration, builder.Environment);

var app = builder.Build();

const int seedAttempts = 5;
for (int attempt = 1; attempt <= seedAttempts; attempt++)
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await AdminConfigSeeder.SeedAsync(db, app.Services.GetRequiredService<ILogger<Program>>());

        var config = scope.ServiceProvider.GetRequiredService<ConfigService>();
        await config.LoadCacheAsync(db);
        break;
    }
    catch (Exception ex) when (attempt < seedAttempts)
    {
        app.Services.GetRequiredService<ILogger<Program>>()
            .LogWarning(ex, "Startup config seeding failed (attempt {Attempt}/{Total}); retrying in 3s", attempt, seedAttempts);
        await Task.Delay(TimeSpan.FromSeconds(3));
    }
}
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseMiddleware<ExceptionHandlingMiddleware>();
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
});
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<CurrentUserMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program { }

/// <summary>
/// Per-IP budget for <c>POST /auth/phone/start</c>. This bounds provider-quota burn across many
/// distinct numbers from one source; it is deliberately separate from
/// <see cref="PhoneVerificationService.MaxPendingPerPhone"/>, which only bounds abuse against a
/// single target number.
///
/// Every call to <c>start</c> consumes one permit here, including a resumed session (the app
/// passes back <c>ResumeVerificationId</c> so a retry does not mint a second provider session, but
/// the HTTP call still happens and still counts against this budget) — so the numbers below are
/// sized against *request* volume, not provider-session volume.
///
/// Window/limit reasoning:
///  - Legitimate retry: a real caller resuming their own in-flight verification, or retrying after
///    a flaky connection, realistically calls <c>start</c> a handful of times for one number — at
///    most on the order of <see cref="PhoneVerificationService.MaxPendingPerPhone"/> (5) plus a few
///    resumed calls. 30 permits per 15 minutes leaves wide headroom above that for one legitimate
///    sign-up attempt, so it should never surface to a real user.
///  - Mobile carrier NAT: many Mongolian mobile subscribers share a small number of public IPs
///    (CGNAT), so unrelated real users can appear to share one IP within the window. A limit sized
///    to "one user's retries" (e.g. 5-10) would lock out everyone else behind that gateway the
///    moment a handful of concurrent sign-ups landed on it. 30 per 15 minutes tolerates roughly
///    that many concurrent, unrelated legitimate sign-up attempts from one shared IP — generous for
///    a single-market, early-stage app — while still meaningfully throttling a script that walks
///    through hundreds of distinct numbers from one address.
///  - This is a coarse first layer, not a hard stop: an attacker can still stay just under budget
///    indefinitely, or rotate source IPs. It exists to blunt bulk, single-source enumeration; the
///    per-number cap remains the primary defense against any one number being targeted.
/// </summary>
public static class PhoneStartRateLimit
{
    public const string PolicyName = "phone-verification-start";
    public const int PermitLimit = 30;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
}
