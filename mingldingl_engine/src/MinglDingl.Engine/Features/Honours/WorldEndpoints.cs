using System.Security.Claims;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Hall;
using MinglDingl.Engine.Features.Quests;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Honours;

/// The road (stage 5a): quests, chests, honours, the Encounter Log, the Hall and the season.
public sealed class WorldEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("").WithTags("World");
        g.MapGet("/me/quests", (ClaimsPrincipal u, QuestService svc, CancellationToken ct) => svc.BoardAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetQuests");
        g.MapPost("/me/quests/{kind}/claim", (string kind, ClaimsPrincipal u, QuestService svc, CancellationToken ct) =>
            svc.ClaimAsync(u.AccountId(), kind, ct)).AsWrite().WithName("ClaimQuest");
        g.MapGet("/me/chests", (ClaimsPrincipal u, QuestService svc, CancellationToken ct) => svc.ChestsAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetChests");
        g.MapPost("/me/chests/{id:guid}/open", async (Guid id, ClaimsPrincipal u, QuestService svc, CancellationToken ct) =>
            new ChestOpened(await svc.OpenChestAsync(u.AccountId(), id, ct))).AsWrite().WithName("OpenChest");

        g.MapGet("/me/honours", (ClaimsPrincipal u, HonourService svc, CancellationToken ct) => svc.ListAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetHonours");
        g.MapPost("/me/honours/{key}/seen", async (string key, ClaimsPrincipal u, HonourService svc, CancellationToken ct) =>
        {
            await svc.SeenAsync(u.AccountId(), key, ct);
            return Results.NoContent();
        }).AsWrite().WithName("SeenHonour");
        g.MapGet("/me/encounter-log", (ClaimsPrincipal u, HonourService svc, CancellationToken ct) => svc.LogAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetEncounterLog");

        g.MapGet("/hall", (ClaimsPrincipal u, HallService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetHall");
        g.MapGet("/season", (FestivalService svc, CancellationToken ct) => svc.SeasonAsync(ct)).WithName("GetSeason");
    }
}

public sealed record ChestOpened(int Earned);
