using System.Security.Claims;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Encounters;

public sealed class EncounterEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/bonds/{id:guid}/encounter").WithTags("Encounters");
        g.MapGet("", (Guid id, ClaimsPrincipal u, EncounterService svc, CancellationToken ct) => svc.GetAsync(u.AccountId(), id, ct))
            .RequireAuthorization().WithName("GetEncounter");
        g.MapPost("/icebreaker", (Guid id, IcebreakerAnswerRequest req, ClaimsPrincipal u, EncounterService svc, CancellationToken ct) =>
            svc.AnswerIcebreakerAsync(u.AccountId(), id, req.Text, ct)).AsWrite().WithName("AnswerIcebreaker");
        g.MapPost("/trial", (Guid id, TrialAnswerRequest req, ClaimsPrincipal u, EncounterService svc, CancellationToken ct) =>
            svc.AnswerTrialAsync(u.AccountId(), id, req.Index, req.Choice, ct)).AsWrite().WithName("AnswerTrial");

        var m = app.MapGroup("/bonds/{id:guid}/meeting").WithTags("Encounters");
        m.MapPost("", (Guid id, MeetingProposal req, ClaimsPrincipal u, MeetingService svc, CancellationToken ct) =>
            svc.ProposeAsync(u.AccountId(), id, req.VenueId, req.At, ct)).AsWrite().WithName("ProposeMeeting");
        m.MapPost("/{meetingId:guid}/pledge", (Guid id, Guid meetingId, ClaimsPrincipal u, MeetingService svc, CancellationToken ct) =>
            svc.PledgeAsync(u.AccountId(), id, meetingId, ct)).AsWrite().WithName("PledgeMeeting");
        m.MapPost("/{meetingId:guid}/call-off", (Guid id, Guid meetingId, ClaimsPrincipal u, MeetingService svc, CancellationToken ct) =>
            svc.CallOffAsync(u.AccountId(), id, meetingId, ct)).AsWrite().WithName("CallOffMeeting");
        m.MapPost("/{meetingId:guid}/attendance", (Guid id, Guid meetingId, AttendanceRequest req, ClaimsPrincipal u, MeetingService svc, CancellationToken ct) =>
            svc.AnswerAsync(u.AccountId(), id, meetingId, req.Answer, ct)).AsWrite().WithName("AnswerAttendance");
        m.MapPost("/{meetingId:guid}/rating", (Guid id, Guid meetingId, RatingRequest req, ClaimsPrincipal u, MeetingService svc, CancellationToken ct) =>
            svc.RateAsync(u.AccountId(), id, meetingId, req.Stars, ct)).AsWrite().WithName("RateMeeting");
    }
}
