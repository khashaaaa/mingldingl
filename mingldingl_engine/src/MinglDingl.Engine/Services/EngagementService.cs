using Microsoft.EntityFrameworkCore;

public class EngagementService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;

    public EngagementService(AppDbContext db, ScoreService score)
    {
        _db = db;
        _score = score;
    }

    public static int CalculateCompatibility(Dictionary<Guid, string> r1, Dictionary<Guid, string> r2)
    {
        var commonKeys = r1.Keys.Intersect(r2.Keys).ToList();
        if (commonKeys.Count == 0) return 0;
        int matches = commonKeys.Count(k => r1[k] == r2[k]);
        return (int)Math.Round((double)matches / commonKeys.Count * 100);
    }

    public async Task<bool> BothRespondedAsync(Guid matchId, Guid icebreakerId)
    {
        var responses = await _db.IcebreakerResponses
            .Where(r => r.MatchId == matchId && r.IcebreakerId == icebreakerId)
            .ToListAsync();
        return responses.Count >= 2;
    }

    /// <summary>
    /// Marks the match's icebreaker done and pays both sides, once. Returns whether it actually
    /// paid, so the caller can report the real figure: a match only completes its icebreaker once,
    /// and every later icebreaker on it is worth nothing.
    /// </summary>
    public async Task<bool> CompleteIcebreakerAsync(Guid matchId, Guid userId1, Guid userId2)
    {
        // Claimed in one conditional UPDATE: both sides answering at once each read the flag unset
        // from their own load and each paid both participants.
        return await _db.InTransactionAsync(async () =>
        {
            int claimed = await _db.Matches
                .Where(m => m.Id == matchId && !m.IcebreakerComplete)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(m => m.IcebreakerComplete, true)
                    .SetProperty(m => m.VideoCallUnlocked, true));
            if (claimed == 0) return false;

            var tracked = _db.Tracked<Match>(m => m.Id == matchId);
            if (tracked is not null)
            {
                _db.SyncFromDatabase(tracked, m => m.IcebreakerComplete, true);
                _db.SyncFromDatabase(tracked, m => m.VideoCallUnlocked, true);
            }

            await _score.AwardManyAsync([(userId1, "IcebreakerDone"), (userId2, "IcebreakerDone")]);
            return true;
        });
    }
}
