using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Config;

namespace MinglDingl.Engine.Features.Admin;

public sealed class AdminEndpoints : IEndpointModule
{
    public const string Policy = "Admin";

    public void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/admin/auth/login", (AdminLoginRequest req, AdminAuth auth, HttpContext http) =>
            auth.Login(req.Username, req.Password, http.Connection.RemoteIpAddress?.ToString() ?? "unknown"))
            .WithTags("Admin").WithName("AdminLogin");

        var g = app.MapGroup("/admin").WithTags("Admin").RequireAuthorization(Policy);

        g.MapGet("/users", (string? search, string? cursor, int? limit, AdminUsers users, CancellationToken ct) =>
            users.ListAsync(search, cursor, limit ?? 50, ct)).WithName("AdminListUsers");
        g.MapGet("/users/{id:guid}", (Guid id, AdminUsers users, CancellationToken ct) =>
            users.DetailAsync(id, ct)).WithName("AdminGetUser");
        g.MapGet("/config", (IConfig config) => config.All()).WithName("AdminGetConfig");
        g.MapPut("/config/{key}", (string key, ConfigWriteRequest req, ConfigWrites writes) =>
            writes.SetAsync(key, req.Value)).WithName("AdminSetConfig");
        g.MapGet("/threads", (Features.Threads.ThreadService threads, CancellationToken ct) => threads.AdminListAsync(ct))
            .WithName("AdminListThreads");
        g.MapGet("/gatherings", (Features.Square.SquareService sq, CancellationToken ct) => sq.AdminListAsync(ct))
            .WithName("AdminListGatherings");
        g.MapPost("/gatherings", (Features.Square.GatheringWriteRequest req, Features.Square.SquareService sq, CancellationToken ct) =>
            sq.RingAsync(req, ct)).WithName("AdminRingBell");
        g.MapPost("/gatherings/{id:guid}/cancel", async (Guid id, Features.Square.SquareService sq, CancellationToken ct) =>
        {
            await sq.CancelAsync(id, ct);
            return Results.NoContent();
        }).WithName("AdminCancelGathering");
        g.MapGet("/codex", (AdminWorld w, CancellationToken ct) => w.CodexAsync(ct)).WithName("AdminListCodex");
        g.MapGet("/codex/{slug}", (string slug, AdminWorld w, CancellationToken ct) => w.CodexPageAsync(slug, ct)).WithName("AdminGetCodex");
        g.MapPut("/codex/{slug}", (string slug, CodexWriteRequest req, AdminWorld w, CancellationToken ct) =>
            w.SaveCodexAsync(slug, req, ct)).WithName("AdminSaveCodex");
        g.MapGet("/festivals", (AdminWorld w, CancellationToken ct) => w.FestivalsAsync(ct)).WithName("AdminListFestivals");
        g.MapPost("/festivals", (FestivalWriteRequest req, AdminWorld w, CancellationToken ct) => w.SaveFestivalAsync(null, req, ct))
            .WithName("AdminAddFestival");
        g.MapPut("/festivals/{id:guid}", (Guid id, FestivalWriteRequest req, AdminWorld w, CancellationToken ct) =>
            w.SaveFestivalAsync(id, req, ct)).WithName("AdminSaveFestival");
        g.MapGet("/audit", (DateTimeOffset? before, AdminWorld w, CancellationToken ct) => w.AuditAsync(before, ct)).WithName("AdminAudit");
    }
}
