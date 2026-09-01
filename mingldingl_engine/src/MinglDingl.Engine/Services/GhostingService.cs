using Microsoft.EntityFrameworkCore;

public class GhostingService
{
    private static readonly TimeSpan GhostThreshold = TimeSpan.FromHours(48);

    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly OathService _oaths;
    private readonly SupabaseBroadcastService _broadcast;

    public GhostingService(AppDbContext db, ScoreService score, OathService oaths, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _oaths = oaths;
        _broadcast = broadcast;
    }

    public async Task<bool> CheckAsync(Match match)
    {
        if (!IsStale(match)) return false;

        if (!await TryGhostAsync(match)) return false;

        var atFault = GetGhostAtFaultUserId(match);
        if (atFault.HasValue)
            await _score.AwardManyAsync([(atFault.Value, "GhostPenalty")]);

        if (atFault.HasValue) await _oaths.RefreshAsync(atFault.Value);

        await BroadcastGhostedAsync(match.Id, atFault);

        return true;
    }

    public async Task<bool> TryGhostAsync(Match match)
    {
        int frozenLevel = RevealService.LevelForMessageCount(match.MessageCount);
        int rowsAffected = await _db.Matches
            .Where(m => m.Id == match.Id && m.Status == "Active")
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.Status, "Ghosted")
                .SetProperty(m => m.RevealLevel, frozenLevel));
        if (rowsAffected == 0) return false;

        match.Status = "Ghosted";
        match.RevealLevel = frozenLevel;
        return true;
    }

    public Task BroadcastGhostedAsync(Guid matchId, Guid? atFaultUserId) =>
        _broadcast.BroadcastAsync("app-nudges", "match_status_changed",
            new { matchId, status = "Ghosted", userId = atFaultUserId });

    /// <summary>Exposed so the sweep can push the same cutoff into SQL instead of filtering in memory.</summary>
    public static TimeSpan StaleAfter => GhostThreshold;

    public static bool IsStale(Match match) =>
        match.Status == "Active" && match.LastMessageAt.HasValue &&
        DateTime.UtcNow - match.LastMessageAt.Value > GhostThreshold;

    public static Guid? GetGhostAtFaultUserId(Match match) =>
        match.LastMessageSenderId is null ? null :
        match.LastMessageSenderId == match.InitiatorId ? match.ReceiverId : match.InitiatorId;
}
