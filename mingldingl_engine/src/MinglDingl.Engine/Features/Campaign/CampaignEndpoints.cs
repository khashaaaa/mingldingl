using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Campaign;

public sealed class CampaignEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/bonds/{id:guid}").WithTags("Campaign");
        g.MapGet("/campaign", (Guid id, ClaimsPrincipal u, CampaignService svc, CancellationToken ct) =>
            svc.GetAsync(u.AccountId(), id, ct)).RequireAuthorization().WithName("GetCampaign");
        g.MapPost("/retire", (Guid id, ClaimsPrincipal u, CampaignService svc, CancellationToken ct) =>
            svc.AskRetireAsync(u.AccountId(), id, ct)).AsWrite().WithName("AskRetire");
        g.MapPost("/retire/{answer}", (Guid id, string answer, ClaimsPrincipal u, CampaignService svc, CancellationToken ct) =>
            svc.AnswerRetireAsync(u.AccountId(), id, answer == "yes", ct)).AsWrite().WithName("AnswerRetire");

        g.MapGet("/weekly", async (Guid id, ClaimsPrincipal u, WeeklyTrialService svc, CancellationToken ct) =>
            await svc.GetAsync(u.AccountId(), id, ct) is { } v ? Results.Ok(v) : Results.NoContent())
            .RequireAuthorization().WithName("GetWeeklyTrial")
            .Produces<WeeklyTrialView>().Produces(StatusCodes.Status204NoContent);
        g.MapPost("/weekly/{game:int}", (Guid id, int game, WeeklyAnswerRequest req, ClaimsPrincipal u, WeeklyTrialService svc,
            CancellationToken ct) => svc.AnswerAsync(u.AccountId(), id, game, req, ct)).AsWrite().WithName("AnswerWeeklyTrial");
        g.MapPost("/weekly/speed/open", (Guid id, ClaimsPrincipal u, WeeklyTrialService svc, CancellationToken ct) =>
            svc.OpenSpeedAsync(u.AccountId(), id, ct)).AsWrite().WithName("OpenSpeedGame");
    }
}
