using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Square;

public sealed class SquareEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/square").WithTags("Square");
        g.MapGet("", (ClaimsPrincipal u, SquareService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetSquare");
        g.MapPost("/{id:guid}/seat", (Guid id, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.TakeSeatAsync(u.AccountId(), id, ct)).AsWrite().WithName("TakeSeat");
        g.MapDelete("/{id:guid}/seat", (Guid id, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.GiveUpSeatAsync(u.AccountId(), id, ct)).AsWrite().WithName("GiveUpSeat");
        g.MapGet("/{id:guid}/night", (Guid id, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.NightAsync(u.AccountId(), id, ct)).RequireAuthorization().WithName("GetNight");
        g.MapPost("/{id:guid}/join", (Guid id, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.JoinAsync(u.AccountId(), id, ct)).AsWrite().WithName("JoinSquare");
        g.MapPost("/{id:guid}/leave", (Guid id, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.LeaveAsync(u.AccountId(), id, ct)).AsWrite().WithName("LeaveSquare");
        g.MapPost("/{id:guid}/decide", (Guid id, DecideRequest req, ClaimsPrincipal u, SquareService svc, CancellationToken ct) =>
            svc.DecideAsync(u.AccountId(), id, req.Yes, ct)).AsWrite().WithName("DecideSquare");
    }
}
