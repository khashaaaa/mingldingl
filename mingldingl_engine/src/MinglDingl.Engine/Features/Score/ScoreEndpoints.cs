using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Score;

public sealed class ScoreEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("").WithTags("Score");
        g.MapPost("/me/dawn", (ClaimsPrincipal u, ScoreService svc, CancellationToken ct) => svc.DawnAsync(u.AccountId(), ct))
            .AsWrite().WithName("Dawn");
        g.MapPost("/me/tier-up/seen", async (ClaimsPrincipal u, ScoreService svc, CancellationToken ct) =>
        {
            await svc.SeenTierUpAsync(u.AccountId(), ct);
            return Results.NoContent();
        }).AsWrite().WithName("SeenTierUp");
        g.MapGet("/me/deeds", (DateTimeOffset? before, int? limit, ClaimsPrincipal u, ScoreService svc, CancellationToken ct) =>
            svc.DeedsAsync(u.AccountId(), before, limit ?? 30, ct)).RequireAuthorization().WithName("GetDeeds");
        g.MapGet("/tiers", (ScoreService svc) => svc.Ladder()).WithName("GetTiers");
    }
}
