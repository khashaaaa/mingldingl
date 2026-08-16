public class GhostingService
{
    private static readonly TimeSpan GhostThreshold = TimeSpan.FromHours(48);

    private readonly AppDbContext _db;
    private readonly ScoreService _score;

    public GhostingService(AppDbContext db, ScoreService score)
    {
        _db = db;
        _score = score;
    }

    public async Task<bool> CheckAsync(Match match)
    {
        if (!IsStale(match)) return false;

        match.Status = "Ghosted";
        var atFault = GetGhostAtFaultUserId(match);
        if (atFault.HasValue)
            await _score.AwardManyAsync([(atFault.Value, "GhostPenalty")]);
        await _db.SaveChangesAsync();
        return true;
    }

    public static bool IsStale(Match match) =>
        match.Status == "Active" && match.LastMessageAt.HasValue &&
        DateTime.UtcNow - match.LastMessageAt.Value > GhostThreshold;

    // Whoever didn't send the last message owes the reply — they're the one who went silent.
    // Null for legacy matches predating LastMessageSenderId (not yet backfilled): skip the
    // penalty rather than guessing who's at fault.
    public static Guid? GetGhostAtFaultUserId(Match match) =>
        match.LastMessageSenderId is null ? null :
        match.LastMessageSenderId == match.InitiatorId ? match.ReceiverId : match.InitiatorId;
}
