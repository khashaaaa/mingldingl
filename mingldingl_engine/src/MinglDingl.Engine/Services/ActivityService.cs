using Microsoft.EntityFrameworkCore;

public class ActivityService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;

    public ActivityService(AppDbContext db, ScoreService score, QuestService quests, MilestoneService milestones, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _quests = quests;
        _milestones = milestones;
        _broadcast = broadcast;
    }

    public async Task<List<ActivitySuggestion>> GetOrCreateSuggestionsAsync(Guid matchId)
    {
        // Ordered explicitly — without it, Postgres doesn't guarantee row
        // order is stable across calls, so the two participants could see
        // these 3 cards in a different order on each fetch. Since the UI
        // has no other way to identify "the same" suggestion between two
        // people, that silently let each side pledge to a different
        // business and never actually complete the shared confirmation.
        var existing = await _db.ActivitySuggestions
            .Include(a => a.BusinessPartner)
            .Where(a => a.MatchId == matchId)
            .OrderBy(a => a.SuggestedAt)
            .ToListAsync();
        if (existing.Count > 0) return existing;

        var match = await _db.Matches.Include(m => m.Initiator).FirstAsync(m => m.Id == matchId);

        // Pull a quality-biased pool, then pick 3 at random from it — every
        // match always getting the exact same top-3 featured venues wasted
        // the point of having more than 3 businesses per city; this way
        // different matches actually see different suggestions.
        var pool = await _db.BusinessPartners
            .Where(b => b.IsVerified && b.City == match.Initiator.City)
            .OrderByDescending(b => b.IsFeatured)
            .ThenByDescending(b => b.AverageRating)
            .Take(10)
            .ToListAsync();

        var businesses = pool
            .OrderBy(_ => Guid.NewGuid())
            .Take(3)
            .ToList();

        var suggestions = businesses.Select(b => new ActivitySuggestion
        {
            MatchId = matchId,
            BusinessPartnerId = b.Id,
            ActivityType = b.Category,
            Title = $"{b.Category} at {b.Name}",
            BusinessPartner = b,
        }).ToList();

        _db.ActivitySuggestions.AddRange(suggestions);
        await _db.SaveChangesAsync();
        return suggestions;
    }

    // Confirmation is null when activitySuggestionId doesn't belong to this
    // match. Awarded is the calling user's own real total for this call (0
    // unless this confirmation is the one that completes the pair —
    // DateConfirmed plus any "pledge" daily-quest bonus), so the client can
    // reflect the actual score change instead of assuming a fixed amount.
    public async Task<(DateConfirmation? Confirmation, int Awarded)> ConfirmAsync(Match match, Guid userId, Guid activitySuggestionId)
    {
        var suggestionBelongsToMatch = await _db.ActivitySuggestions
            .AnyAsync(s => s.Id == activitySuggestionId && s.MatchId == match.Id);
        if (!suggestionBelongsToMatch) return (null, 0);

        var confirmation = await _db.DateConfirmations
            .FirstOrDefaultAsync(c => c.MatchId == match.Id && c.ActivitySuggestionId == activitySuggestionId)
            ?? new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = activitySuggestionId };

        bool wasComplete = confirmation.IsComplete;

        if (match.InitiatorId == userId) confirmation.InitiatorConfirmed = true;
        else confirmation.ReceiverConfirmed = true;

        if (_db.Entry(confirmation).State == EntityState.Detached)
            _db.DateConfirmations.Add(confirmation);

        bool justCompleted = !wasComplete && confirmation.IsComplete;

        if (justCompleted)
        {
            await _score.AwardManyAsync([(match.InitiatorId, "DateConfirmed"), (match.ReceiverId, "DateConfirmed")]);
            match.VideoCallUnlocked = true;
        }

        await _db.SaveChangesAsync();

        int awarded = 0;
        if (justCompleted)
        {
            var otherUserId = match.OtherParticipant(userId);
            int myQuestBonus = await _quests.IncrementAsync(userId, "pledge");
            await _quests.IncrementAsync(otherUserId, "pledge");
            awarded = ScoreService.GetDelta("DateConfirmed") + myQuestBonus;
            await _milestones.AchieveAsync(match.InitiatorId, "first_pledged_encounter");
            await _milestones.AchieveAsync(match.ReceiverId, "first_pledged_encounter");
            await _broadcast.BroadcastAsync("app-nudges", "date_confirmed", new { matchId = match.Id });
        }

        return (confirmation, awarded);
    }
}
