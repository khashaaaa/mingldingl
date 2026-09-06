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
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null || match.IcebreakerComplete) return false;
        match.IcebreakerComplete = true;

        match.VideoCallUnlocked = true;
        await _score.AwardManyAsync([(userId1, "IcebreakerDone"), (userId2, "IcebreakerDone")]);
        await _db.SaveChangesAsync();
        return true;
    }
}
