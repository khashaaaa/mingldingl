using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
    opt.InvalidModelStateResponseFactory = context =>
    {
        var message = context.ModelState
            .SelectMany(kvp => kvp.Value?.Errors.Select(e => e.ErrorMessage) ?? [])
            .FirstOrDefault() ?? "Invalid request";
        return new BadRequestObjectResult(new { error = message });
    };
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
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
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
app.UseAuthentication();
app.UseMiddleware<CurrentUserMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.Run();

public partial class Program { }
