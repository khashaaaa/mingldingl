using MinglDingl.Engine;
using MinglDingl.Engine.Cli;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

var exportPath = args is ["export-swagger", var path] ? path : null;

var builder = WebApplication.CreateBuilder(args);
if (!string.IsNullOrEmpty(builder.Configuration["Sentry:Dsn"]))
    builder.WebHost.UseSentry(o =>
    {
        o.SendDefaultPii = false;
        o.TracesSampleRate = 0.2;
        o.SetBeforeSend((e, _) => SentryScrub.Scrub(e));
    });
builder.Services.AddEngine(builder.Configuration, builder.Environment);

var app = builder.Build();

app.UseForwardedHeaders();
app.UseMiddleware<ErrorMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<MinglDingl.Engine.Features.Admin.AuditMiddleware>();
if (app.Environment.IsDevelopment() || exportPath is not null) app.MapOpenApi();
app.MapHub<MinglDingl.Engine.Features.Live.LiveHub>("/live");
app.MapHub<MinglDingl.Engine.Features.Live.AdminLiveHub>("/admin/live");
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithName("Health");
foreach (var module in app.Services.GetServices<IEndpointModule>()) module.Map(app);

if (exportPath is not null)
{
    await ExportSwagger.RunAsync(app, exportPath);
    return;
}

if (args is ["hash-password", var password])
{
    Console.WriteLine(MinglDingl.Engine.Features.Admin.AdminPasswordHasher.Hash(password));
    return;
}

if (args is ["seed", var state, ..])
{
    await Seed.RunAsync(app, state, args);
    return;
}

await DatabaseBootstrap.RunAsync(app.Services);
// Outside Development the Rite has no other way in: with video on, Agora must be fully set
// (the NCS secret is how the engine learns who joined), or every Rite and meeting would stall.
var agora = app.Services.GetRequiredService<MinglDingl.Engine.Features.Video.AgoraSettings>();
if (!agora.DevPresence && app.Services.GetRequiredService<IConfig>().Bool(ConfigKeys.VideoEnabled)
    && (!agora.Ready || string.IsNullOrWhiteSpace(agora.NcsSecret)))
    throw new InvalidOperationException("video.enabled needs Agora:AppId, Agora:AppCertificate and Agora:NcsSecret");

app.Run();

public partial class Program;
