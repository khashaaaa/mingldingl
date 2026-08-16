using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

// One-off CLI mode for generating an Admin:PasswordHash value for
// appsettings — exits before the web host boots, no DB connection needed.
// Usage: dotnet run -- hash-password <password>
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

// Match the { error: "..." } shape used everywhere else, instead of the
// framework's default ProblemDetails, for automatic model-validation 400s too.
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
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(dataSource));

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
    // Separate scheme for mingldingl_control — self-issued/self-validated
    // (symmetric key, no JWKS authority) so an admin token can never be
    // confused with a Supabase-issued user token or vice versa. Admin
    // controllers opt in explicitly via [Authorize(AuthenticationSchemes = "AdminBearer")];
    // this scheme is never the default, so regular [Authorize] on app
    // endpoints is unaffected.
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
builder.Services.AddCors(opt => opt.AddDefaultPolicy(p =>
    p.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    foreach (var def in ConfigKeys.All)
    {
        if (!await db.AdminConfigs.AnyAsync(c => c.Key == def.Key))
        {
            db.AdminConfigs.Add(new AdminConfig
            {
                Key = def.Key,
                Category = def.Category,
                ValueType = def.ValueType,
                Value = def.DefaultValue,
                Description = def.Description,
                UpdatedAt = DateTime.UtcNow,
                UpdatedBy = "system",
            });
        }
    }
    await db.SaveChangesAsync();

    var config = scope.ServiceProvider.GetRequiredService<ConfigService>();
    await config.LoadCacheAsync(db);
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
