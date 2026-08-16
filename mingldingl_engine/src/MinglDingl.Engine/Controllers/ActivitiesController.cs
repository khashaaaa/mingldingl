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
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");
        if (match.MessageCount < 15)
            return this.BadRequestError("Keep chatting to unlock activity suggestions");

        var suggestions = await _activities.GetOrCreateSuggestionsAsync(matchId);
        var confirmations = await _db.DateConfirmations.Where(c => c.MatchId == matchId).ToListAsync();
        bool isInitiator = match.InitiatorId == userId;
        bool myRated = await _db.BusinessRatings.AnyAsync(r => r.MatchId == matchId && r.UserId == userId);

        return Ok(suggestions.Select(s => ToResponse(s, confirmations, isInitiator, myRated)).ToList());
    }

    // The caller's own confirmed dates across every match, newest first — the
    // "trophy case" view of Group B's post-date memory feature. Reuses
    // DateConfirmation/BusinessRating rows the confirm/rate flows already
    // write; no new table.
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
                return new TrophyResponse(
                    c.MatchId,
                    s?.Title ?? "",
                    s?.BusinessPartner?.Name,
                    s?.BusinessPartner?.PhotoUrls.FirstOrDefault(),
                    c.CreatedAt,
                    myRating?.Stars,
                    myRating?.PhotoUrl);
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
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var (confirmation, awarded) = await _activities.ConfirmAsync(match, userId, req.ActivitySuggestionId);
        if (confirmation is null) return this.NotFoundError("Activity suggestion not found for this match");

        return Ok(new ConfirmDateResponse(confirmation.InitiatorConfirmed, confirmation.ReceiverConfirmed, confirmation.IsComplete, awarded));
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
