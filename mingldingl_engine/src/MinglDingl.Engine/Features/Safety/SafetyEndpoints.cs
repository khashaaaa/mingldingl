using System.Security.Claims;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Safety;

public sealed class SafetyEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("").WithTags("Safety");
        g.MapGet("/blocks", (ClaimsPrincipal u, SafetyService svc, CancellationToken ct) => svc.CastOutListAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetBlocks");
        g.MapPost("/blocks/{id:guid}", async (Guid id, ClaimsPrincipal u, SafetyService svc, CancellationToken ct) =>
        {
            await svc.CastOutAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("CastOut");
        g.MapDelete("/blocks/{id:guid}", async (Guid id, ClaimsPrincipal u, SafetyService svc, CancellationToken ct) =>
        {
            await svc.LetInAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("LetIn");
        g.MapPost("/reports", async (ReportRequest req, ClaimsPrincipal u, SafetyService svc, CancellationToken ct) =>
        {
            await svc.ReportAsync(u.AccountId(), req, ct);
            return Results.NoContent();
        }).AsWrite().WithName("Report");

        var admin = app.MapGroup("/admin/reports").WithTags("Admin").RequireAuthorization(AdminEndpoints.Policy);
        admin.MapGet("", (string? status, DateTimeOffset? before, int? limit, SafetyService svc, CancellationToken ct) =>
            svc.AdminListAsync(status, before, limit ?? 50, ct)).WithName("AdminListReports");
        admin.MapGet("/{id:guid}", (Guid id, SafetyService svc, CancellationToken ct) => svc.AdminDetailAsync(id, ct))
            .WithName("AdminGetReport");
        admin.MapPost("/{id:guid}/resolve", (Guid id, ResolveReportRequest req, SafetyService svc, CancellationToken ct) =>
            svc.ResolveAsync(id, req, ct)).WithName("AdminResolveReport");
    }
}
