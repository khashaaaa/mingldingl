using MinglDingl.Engine.Kernel;

namespace MinglDingl.Engine.Features.Codex;

public sealed class CodexEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/codex").WithTags("Codex");
        g.MapGet("", (string? locale, CodexService svc, CancellationToken ct) => svc.ListAsync(locale ?? "en", ct))
            .WithName("GetCodex");
        g.MapGet("/{slug}", (string slug, string? locale, CodexService svc, CancellationToken ct) =>
            svc.GetAsync(slug, locale ?? "en", ct)).WithName("GetCodexPage");
    }
}
