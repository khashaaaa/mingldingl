using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Bonds;

public sealed class BondEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/bonds").WithTags("Bonds");
        g.MapGet("", (ClaimsPrincipal u, BondService svc, CancellationToken ct) => svc.ListAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetBonds");
        g.MapGet("/{id:guid}", (Guid id, ClaimsPrincipal u, BondService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), id, ct))
            .RequireAuthorization().WithName("GetBond");
        g.MapGet("/{id:guid}/letters", (Guid id, DateTimeOffset? before, int? limit, ClaimsPrincipal u, BondService svc, CancellationToken ct) =>
            svc.LettersAsync(u.AccountId(), id, before, limit ?? 50, ct)).RequireAuthorization().WithName("GetLetters");
        g.MapPost("/{id:guid}/letters", (Guid id, WriteLetterRequest req, ClaimsPrincipal u, BondService svc, CancellationToken ct) =>
            svc.WriteAsync(u.AccountId(), id, req.Text, ct)).AsWrite().WithName("WriteLetter");
        g.MapPost("/{id:guid}/read", async (Guid id, ClaimsPrincipal u, BondService svc, CancellationToken ct) =>
        {
            await svc.ReadAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("ReadBond");
        g.MapPost("/{id:guid}/sever", async (Guid id, ClaimsPrincipal u, BondService svc, CancellationToken ct) =>
        {
            await svc.SeverAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("SeverBond");
    }
}
