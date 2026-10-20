using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Wanderings;

public sealed class WanderingEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/bonds/{id:guid}/wanderings").WithTags("Wanderings");
        g.MapGet("", (Guid id, ClaimsPrincipal u, WanderingService svc, CancellationToken ct) => svc.ListAsync(u.AccountId(), id, ct))
            .RequireAuthorization().WithName("GetWanderings");
        g.MapGet("/{key}", (Guid id, string key, ClaimsPrincipal u, WanderingService svc, CancellationToken ct) =>
            svc.GetAsync(u.AccountId(), id, key, ct)).RequireAuthorization().WithName("GetWandering");
        g.MapPost("/{key}/ask", (Guid id, string key, ClaimsPrincipal u, WanderingService svc, CancellationToken ct) =>
            svc.AskAsync(u.AccountId(), id, key, ct)).AsWrite().WithName("AskWandering");
        g.MapPost("/{key}/{answer:regex(^(yes|no)$)}", (Guid id, string key, string answer, ClaimsPrincipal u, WanderingService svc,
            CancellationToken ct) => svc.AnswerAsync(u.AccountId(), id, key, answer == "yes", ct)).AsWrite().WithName("AnswerWandering");
        g.MapPost("/{key}/line", (Guid id, string key, WanderingLineRequest req, ClaimsPrincipal u, WanderingService svc,
            CancellationToken ct) => svc.LineAsync(u.AccountId(), id, key, req.Text, ct)).AsWrite().WithName("WriteWanderingLine");

        var a = app.MapGroup("/admin/wanderings").WithTags("Admin").RequireAuthorization(Admin.AdminEndpoints.Policy);
        a.MapGet("", (WanderingService svc, CancellationToken ct) => svc.AdminListAsync(ct)).WithName("AdminListWanderings");
        a.MapGet("/{key}", (string key, WanderingService svc, CancellationToken ct) => svc.AdminGetAsync(key, ct)).WithName("AdminGetWandering");
        a.MapPut("/{key}", (string key, WanderingWriteRequest req, WanderingService svc, CancellationToken ct) =>
            svc.AdminSaveAsync(key, req, ct)).WithName("AdminSaveWandering");
    }
}
