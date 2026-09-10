using Microsoft.EntityFrameworkCore;

public enum ConfirmRejection
{
    SuggestionNotInMatch,
    FlameRiteIncomplete,
}

public record ConfirmResult(DateConfirmation? Confirmation, ConfirmRejection? Rejection);

public class ActivityService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ConfigService _config;
    private readonly OathService _oaths;
    private readonly PushNotificationService _push;
    private readonly HonourService _honours;

    public ActivityService(AppDbContext db, ScoreService score, QuestService quests, MilestoneService milestones, SupabaseBroadcastService broadcast, ConfigService config, OathService oaths, PushNotificationService push, HonourService honours)
    {
        _push = push;
        _db = db;
        _score = score;
        _quests = quests;
        _milestones = milestones;
        _broadcast = broadcast;
        _config = config;
        _oaths = oaths;
        _honours = honours;
    }

    public async Task<List<ActivitySuggestion>> GetOrCreateSuggestionsAsync(Guid matchId)
    {
        var existing = await _db.ActivitySuggestions
            .Include(a => a.BusinessPartner)
            .Where(a => a.MatchId == matchId)
            .OrderBy(a => a.SuggestedAt)
            .ToListAsync();
        if (existing.Count > 0) return existing;

        var match = await _db.Matches.Include(m => m.Initiator).FirstAsync(m => m.Id == matchId);

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

    public async Task<(ConfirmResult Result, int Awarded)> ConfirmAsync(Match match, Guid userId, Guid activitySuggestionId)
    {
        var suggestionBelongsToMatch = await _db.ActivitySuggestions
            .AnyAsync(s => s.Id == activitySuggestionId && s.MatchId == match.Id);
        if (!suggestionBelongsToMatch) return (new ConfirmResult(null, ConfirmRejection.SuggestionNotInMatch), 0);

        bool riteRequired = _config.FlameRiteRequired();
        if (riteRequired)
        {
            bool riteCompleted = await _db.Matches
                .AsNoTracking()
                .Where(m => m.Id == match.Id)
                .Select(m => m.FlameRiteCompletedAt)
                .FirstAsync() is not null;
            if (!riteCompleted)
                return (new ConfirmResult(null, ConfirmRejection.FlameRiteIncomplete), 0);
        }

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
            confirmation.CompletedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        int awarded = 0;
        if (justCompleted)
        {
            var otherUserId = match.OtherParticipant(userId);
            int myQuestBonus = await _quests.IncrementAsync(userId, "pledge");
            await _quests.IncrementAsync(otherUserId, "pledge");
            awarded = _score.Delta("DateConfirmed") + myQuestBonus;
            await _milestones.AchieveAsync(match.InitiatorId, "first_pledged_encounter");
            await _milestones.AchieveAsync(match.ReceiverId, "first_pledged_encounter");

            await _oaths.RefreshAsync(match.InitiatorId);
            await _oaths.RefreshAsync(match.ReceiverId);

            // The caller is looking at the screen that just confirmed; the other side pledged
            // earlier and is the one who needs telling.
            await _push.NotifyUserAsync(
                otherUserId,
                PushKind.DateConfirmed,
                new Dictionary<string, object> { ["matchId"] = match.Id.ToString() });
        }

        await _broadcast.BroadcastAsync("app-nudges", "date_confirmed",
            new { userId, matchId = match.Id, isComplete = confirmation.IsComplete });

        return (new ConfirmResult(confirmation, null), awarded);
    }

    private async Task<DateConfirmation?> LoadLatestCompletedConfirmationAsync(Guid matchId) =>
        await _db.DateConfirmations
            .Where(c => c.MatchId == matchId && c.CompletedAt != null)
            .OrderByDescending(c => c.CompletedAt)
            .FirstOrDefaultAsync();

    public async Task<(bool Due, string? ActivityTitle)> GetAttendanceCheckStatusAsync(Guid matchId, Guid userId)
    {
        var confirmation = await LoadLatestCompletedConfirmationAsync(matchId);
        if (confirmation is null) return (false, null);
        double delayHours = Math.Max(0, _config.GetNumber("dating.attendance_check.delay_hours", 48));
        if (DateTime.UtcNow - confirmation.CompletedAt!.Value < TimeSpan.FromHours(delayHours)) return (false, null);

        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return (false, null);
        bool isInitiator = match.InitiatorId == userId;
        bool alreadyAnswered = isInitiator ? confirmation.InitiatorAttended.HasValue : confirmation.ReceiverAttended.HasValue;
        if (alreadyAnswered) return (false, null);

        var suggestion = await _db.ActivitySuggestions.FindAsync(confirmation.ActivitySuggestionId);
        return (true, suggestion?.Title);
    }

    public async Task<bool?> SubmitAttendanceAsync(Guid matchId, Guid userId, bool attended)
    {
        var confirmation = await LoadLatestCompletedConfirmationAsync(matchId);
        if (confirmation is null) return null;

        var match = await _db.Matches.FindAsync(matchId);
        if (match is null || !match.IsParticipant(userId)) return null;
        bool isInitiator = match.InitiatorId == userId;

        bool alreadyAnswered = isInitiator ? confirmation.InitiatorAttended.HasValue : confirmation.ReceiverAttended.HasValue;
        if (alreadyAnswered) return isInitiator ? confirmation.InitiatorAttended : confirmation.ReceiverAttended;

        if (isInitiator) confirmation.InitiatorAttended = attended;
        else confirmation.ReceiverAttended = attended;
        await _db.SaveChangesAsync();

        if (confirmation.InitiatorAttended == true && confirmation.ReceiverAttended == true)
        {
            await _honours.GrantAsync(match.InitiatorId, "title_trueword", "encounter_kept");
            await _honours.GrantAsync(match.ReceiverId, "title_trueword", "encounter_kept");
        }

        // Each side is asked whether THE OTHER showed up — that is what
        // dating.attendance_check.delay_hours describes and what the app now asks — so a "no" is an
        // accusation, never a confession. Reading it as a confession put the flag on whoever
        // reported being stood up while the no-show, answering "yes", walked away clean: reporting
        // a no-show was the one thing that penalised you for it.
        if (confirmation.InitiatorAttended.HasValue && confirmation.ReceiverAttended.HasValue)
        {
            bool alreadyPenalizedForThisMatch = await _db.DateConfirmations
                .AnyAsync(c => c.MatchId == matchId && c.PenaltyApplied);

            // The initiator answers about the receiver and the receiver about the initiator, so
            // both can be named at once: a date neither side turned up to is two no-shows, not a
            // contradiction to be thrown away.
            var absentees = new List<Guid>();
            if (confirmation.InitiatorAttended == false) absentees.Add(match.ReceiverId);
            if (confirmation.ReceiverAttended == false) absentees.Add(match.InitiatorId);

            if (!alreadyPenalizedForThisMatch && absentees.Count > 0)
            {
                confirmation.PenaltyApplied = true;
                await _db.SaveChangesAsync();

                foreach (var absentUserId in absentees)
                    await FlagNoShowAsync(absentUserId);
            }
        }

        return attended;
    }

    /// <summary>
    /// Records one no-show against a user and docks reputation once they have collected enough of
    /// them. The count moves in SQL because two matches can report the same person concurrently.
    /// </summary>
    private async Task FlagNoShowAsync(Guid absentUserId)
    {
        var updated = await _db.Database.SqlQuery<int>(
            $"""
            UPDATE "Users" SET "NoShowFlagCount" = "NoShowFlagCount" + 1
            WHERE "Id" = {absentUserId}
            RETURNING "NoShowFlagCount"
            """).ToListAsync();
        if (updated.Count == 0) return;

        var trackedUser = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == absentUserId)?.Entity;
        if (trackedUser is not null) trackedUser.NoShowFlagCount = updated[0];

        int threshold = (int)_config.GetNumber("dating.noshow.threshold", 3);
        if (updated[0] >= threshold)
            await _score.ApplyReputationPenaltyAsync(absentUserId, "RepeatedNoShowPenalty");
    }
}
