using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Seek;

public sealed class SeekEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/seek").WithTags("Seek");
        g.MapGet("", (ClaimsPrincipal u, SeekService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetSeek");
        g.MapPost("/{id:guid}/summon", (Guid id, ClaimsPrincipal u, SeekService svc, CancellationToken ct) =>
            svc.SummonAsync(u.AccountId(), id, ct)).AsWrite().WithName("Summon");
        g.MapPost("/{id:guid}/pass", async (Guid id, ClaimsPrincipal u, SeekService svc, CancellationToken ct) =>
        {
            await svc.PassAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("Pass");
        g.MapPost("/second-look", (ClaimsPrincipal u, SeekService svc, CancellationToken ct) => svc.SecondLookAsync(u.AccountId(), ct))
            .AsWrite().WithName("SecondLook");
        g.MapGet("/filters", (ClaimsPrincipal u, SeekService svc, CancellationToken ct) => svc.FiltersAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetSeekFilters");
        g.MapPut("/filters", (SeekFilterRequest req, ClaimsPrincipal u, SeekService svc, CancellationToken ct) =>
            svc.SetFiltersAsync(u.AccountId(), req, ct)).AsWrite().WithName("SetSeekFilters");
    }
}
