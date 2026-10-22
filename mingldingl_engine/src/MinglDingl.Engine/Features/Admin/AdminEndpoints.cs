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
            .RequireRateLimiting(Kernel.RateLimits.RateLimitPolicies.AdminLogin).WithTags("Admin").WithName("AdminLogin");

        var g = app.MapGroup("/admin").WithTags("Admin").RequireAuthorization(Policy);

        g.MapGet("/users", (string? search, string? cursor, int? limit, AdminUsers users, CancellationToken ct) =>
            users.ListAsync(search, cursor, limit ?? 50, ct)).WithName("AdminListUsers");
        g.MapGet("/users/{id:guid}", (Guid id, AdminUsers users, CancellationToken ct) =>
            users.DetailAsync(id, ct)).WithName("AdminGetUser");

        // The keeper's hand: each takes a reason; the audit log keeps it with whom it touched.
        var u = g.MapGroup("/users/{id:guid}");
        async Task<IResult> Hand(HttpContext http, Guid id, string reason, AdminHand hand, AdminUsers users, Func<Task> act,
            string? what = null, bool gone = false, CancellationToken ct = default)
        {
            http.Items["audit.target"] = await hand.NameAsync(id, ct);
            http.Items["audit.note"] = reason.Trim();
            if (what is not null) http.Items["audit.what"] = what;
            await act();
            return gone ? Results.NoContent() : Results.Ok(await users.DetailAsync(id, ct));
        }
        u.MapPost("/suspend", (Guid id, KeeperReason req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.SuspendAsync(id, req.Reason, ct), ct: ct))
            .WithName("AdminSuspendUser").Produces<AdminUserDetail>();
        u.MapPost("/lift", (Guid id, KeeperReason req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.LiftAsync(id, ct), ct: ct))
            .WithName("AdminLiftSuspension").Produces<AdminUserDetail>();
        u.MapPost("/sign-out", (Guid id, KeeperReason req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.SignOutAsync(id, ct), ct: ct))
            .WithName("AdminSignOutUser").Produces<AdminUserDetail>();
        u.MapPost("/delete", (Guid id, KeeperReason req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.DeleteNowAsync(id, ct), gone: true, ct: ct))
            .WithName("AdminDeleteUserNow").Produces(StatusCodes.Status204NoContent);
        u.MapPost("/clear", (Guid id, KeeperClearRequest req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.ClearAsync(id, req.Field, ct), req.Field == "name" ? "name" : "tale", ct: ct))
            .WithName("AdminClearUserText").Produces<AdminUserDetail>();
        u.MapPost("/photos/{photoId:guid}/remove", (Guid id, Guid photoId, KeeperReason req, HttpContext http, AdminHand hand,
            AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.RemovePhotoAsync(id, photoId, ct), ct: ct))
            .WithName("AdminRemoveUserPhoto").Produces<AdminUserDetail>();
        u.MapPost("/floor", (Guid id, KeeperFloorRequest req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.GiveFloorAsync(id, req.Floor, req.Days, ct),
                $"{(req.Floor == "highTable" ? "the High Table" : "the Hall")} for {req.Days} days", ct: ct))
            .WithName("AdminGiveFloor").Produces<AdminUserDetail>();
        u.MapPost("/adjust", (Guid id, KeeperAdjustRequest req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.AdjustAsync(id, req.Points, req.Reputation, ct),
                $"score {req.Points:+#;-#;0} points, {req.Reputation:+#;-#;0} reputation", ct: ct))
            .WithName("AdminAdjustScore").Produces<AdminUserDetail>();
        u.MapPost("/clear-flag", (Guid id, KeeperReason req, HttpContext http, AdminHand hand, AdminUsers users, CancellationToken ct) =>
            Hand(http, id, req.Reason, hand, users, () => hand.ClearFlagAsync(id, ct), ct: ct))
            .WithName("AdminClearUserFlag").Produces<AdminUserDetail>();
        g.MapGet("/barred", (AdminHand hand, CancellationToken ct) => hand.BarredAsync(ct)).WithName("AdminListBarred");
        g.MapPost("/barred/{phone}/lift", async (string phone, KeeperReason req, HttpContext http, AdminHand hand, CancellationToken ct) =>
        {
            http.Items["audit.target"] = phone;
            http.Items["audit.note"] = req.Reason.Trim();
            await hand.UnbarAsync(phone, ct);
            return Results.NoContent();
        }).WithName("AdminUnbarNumber").Produces(StatusCodes.Status204NoContent);
        g.MapGet("/config", (IConfig config) => config.All()).WithName("AdminGetConfig");
        g.MapPut("/config/{key}", (string key, ConfigWriteRequest req, ConfigWrites writes) =>
            writes.SetAsync(key, req.Value)).WithName("AdminSetConfig");
        g.MapGet("/threads", (Features.Threads.ThreadService threads, CancellationToken ct) => threads.AdminListAsync(ct))
            .WithName("AdminListThreads");
        g.MapGet("/gatherings", (Features.Square.SquareService sq, CancellationToken ct) => sq.AdminListAsync(ct))
            .WithName("AdminListGatherings");
        g.MapPost("/gatherings", (Features.Square.GatheringWriteRequest req, Features.Square.SquareService sq, CancellationToken ct) =>
            sq.RingAsync(req, ct)).WithName("AdminRingBell");
        g.MapPut("/gatherings/{id:guid}", (Guid id, Features.Square.GatheringWriteRequest req, Features.Square.SquareService sq, CancellationToken ct) =>
            sq.EditAsync(id, req, ct)).WithName("AdminEditGathering");
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
        g.MapPut("/festivals/{id:guid}", (Guid id, FestivalWriteRequest req, AdminWorld w, CancellationToken ct) =>
            w.SaveFestivalAsync(id, req, ct)).WithName("AdminSaveFestival");
        g.MapGet("/audit", (DateTimeOffset? before, AdminWorld w, CancellationToken ct) => w.AuditAsync(before, ct)).WithName("AdminAudit");
    }
}
