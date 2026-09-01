using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("activities")]
[Authorize]
[Produces("application/json")]
public class ActivitiesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ActivityService _activities;

    public ActivitiesController(AppDbContext db, ActivityService activities)
    {
        _db = db;
        _activities = activities;
    }

    [HttpGet("{matchId}/suggestions")]
    [ProducesResponseType(typeof(List<ActivitySuggestionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetSuggestions(Guid matchId)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;
        if (match.MessageCount < 15)
            return this.BadRequestError("Keep chatting to unlock activity suggestions", "activity.locked");

        var suggestions = await _activities.GetOrCreateSuggestionsAsync(matchId);
        var confirmations = await _db.DateConfirmations.Where(c => c.MatchId == matchId).ToListAsync();
        bool isInitiator = match.InitiatorId == userId;
        bool myRated = await _db.BusinessRatings.AnyAsync(r => r.MatchId == matchId && r.UserId == userId);

        return Ok(suggestions.Select(s => ToResponse(s, confirmations, isInitiator, myRated)).ToList());
    }

    [HttpGet("mine")]
    [ProducesResponseType(typeof(List<TrophyResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyTrophies()
    {
        var userId = this.CurrentUserId();

        var myMatchIds = await _db.Matches.AsNoTracking()
            .Where(m => m.InitiatorId == userId || m.ReceiverId == userId)
            .Select(m => m.Id)
            .ToListAsync();
        if (myMatchIds.Count == 0) return Ok(new List<TrophyResponse>());

        var confirmations = await _db.DateConfirmations.AsNoTracking()
            .Where(c => myMatchIds.Contains(c.MatchId) && c.InitiatorConfirmed && c.ReceiverConfirmed)
            .ToListAsync();
        if (confirmations.Count == 0) return Ok(new List<TrophyResponse>());

        var suggestionIds = confirmations.Select(c => c.ActivitySuggestionId).ToList();
        var suggestions = await _db.ActivitySuggestions.AsNoTracking()
            .Include(s => s.BusinessPartner)
            .Where(s => suggestionIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id);

        var myRatings = await _db.BusinessRatings.AsNoTracking()
            .Where(r => myMatchIds.Contains(r.MatchId) && r.UserId == userId)
            .ToListAsync();

        var trophies = confirmations
            .Select(c =>
            {
                suggestions.TryGetValue(c.ActivitySuggestionId, out var s);
                var myRating = myRatings.FirstOrDefault(r => r.MatchId == c.MatchId);
                bool mismatched = c.InitiatorAttended.HasValue && c.ReceiverAttended.HasValue
                    && c.InitiatorAttended != c.ReceiverAttended;
                return new TrophyResponse(
                    c.MatchId,
                    s?.Title ?? "",
                    s?.BusinessPartner?.Name,
                    s?.BusinessPartner?.PhotoUrls.FirstOrDefault(),
                    c.CreatedAt,
                    myRating?.Stars,
                    myRating?.PhotoUrl,
                    mismatched);
            })
            .OrderByDescending(t => t.ConfirmedAt)
            .ToList();

        return Ok(trophies);
    }

    [HttpPost("{matchId}/confirm")]
    [ProducesResponseType(typeof(ConfirmDateResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ConfirmDate(Guid matchId, [FromBody] ConfirmDateDto req)
    {
        var userId = this.CurrentUserId();

        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId, requireActive: true);
        if (accessError is not null) return accessError;

        var (result, awarded) = await _activities.ConfirmAsync(match, userId, req.ActivitySuggestionId);
        if (result.Rejection == ConfirmRejection.SuggestionNotInMatch)
            return this.NotFoundError("Activity suggestion not found for this match", "activity.suggestion_not_found");
        if (result.Rejection == ConfirmRejection.FlameRiteIncomplete)
            return this.ForbiddenError("Complete the Flame Rite before pledging an encounter", "rite.required_before_pledge");

        var confirmation = result.Confirmation!;
        return Ok(new ConfirmDateResponse(confirmation.InitiatorConfirmed, confirmation.ReceiverConfirmed, confirmation.IsComplete, awarded));
    }

    [HttpGet("{matchId}/attendance-check")]
    [ProducesResponseType(typeof(AttendanceCheckStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAttendanceCheck(Guid matchId)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

        var (due, activityTitle) = await _activities.GetAttendanceCheckStatusAsync(matchId, userId);
        return Ok(new AttendanceCheckStatusResponse(due, activityTitle));
    }

    [HttpPost("{matchId}/attendance-check")]
    [ProducesResponseType(typeof(AttendanceCheckResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PostAttendanceCheck(Guid matchId, [FromBody] AttendanceCheckRequestDto req)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId);
        if (accessError is not null) return accessError;

        var answered = await _activities.SubmitAttendanceAsync(matchId, userId, req.Attended);
        if (answered is null) return this.NotFoundError("No confirmed date eligible for an attendance check on this match", "attendance.no_eligible_date");

        return Ok(new AttendanceCheckResponse(answered.Value));
    }

    private static ActivitySuggestionResponse ToResponse(ActivitySuggestion s, List<DateConfirmation> confirmations, bool isInitiator, bool myRated)
    {
        var confirmation = confirmations.FirstOrDefault(c => c.ActivitySuggestionId == s.Id);
        bool myConfirmed = confirmation is not null && (isInitiator ? confirmation.InitiatorConfirmed : confirmation.ReceiverConfirmed);
        bool isComplete = confirmation?.IsComplete ?? false;

        return new(
            s.Id, s.ActivityType, s.Title,
            s.BusinessPartner is null ? null : new BusinessSummary(
                s.BusinessPartner.Id, s.BusinessPartner.Name, s.BusinessPartner.AverageRating,
                s.BusinessPartner.District, s.BusinessPartner.PhotoUrls.FirstOrDefault()),
            myConfirmed, isComplete, myRated);
    }
}

public record ConfirmDateDto(Guid ActivitySuggestionId);
