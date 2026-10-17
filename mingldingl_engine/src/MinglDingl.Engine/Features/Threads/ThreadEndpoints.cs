using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Threads;

public sealed class ThreadEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("").WithTags("Threads");
        g.MapPost("/threads", (WeaveRequest req, ClaimsPrincipal u, ThreadService svc, CancellationToken ct) =>
            svc.WeaveAsync(u.AccountId(), req, ct)).AsWrite().WithName("WeaveThread");
        g.MapGet("/threads/woven", (ClaimsPrincipal u, ThreadService svc, CancellationToken ct) =>
            svc.WovenAsync(u.AccountId(), ct)).RequireAuthorization().WithName("GetWovenThreads");
        g.MapGet("/threads/for-me", (ClaimsPrincipal u, ThreadService svc, CancellationToken ct) =>
            svc.InvitationsAsync(u.AccountId(), ct)).RequireAuthorization().WithName("GetThreadInvitations");
        g.MapPost("/threads/{id:guid}/answer", (Guid id, ThreadAnswerRequest req, ClaimsPrincipal u, ThreadService svc,
            CancellationToken ct) => svc.AnswerAsync(u.AccountId(), id, req.Yes, ct)).AsWrite().WithName("AnswerThread");
        g.MapGet("/me/ally", (ClaimsPrincipal u, ThreadService svc, CancellationToken ct) => svc.AllyAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetAlly");
    }
}
