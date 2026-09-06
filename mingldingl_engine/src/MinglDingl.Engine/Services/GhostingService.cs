using Microsoft.EntityFrameworkCore;

public class GhostingService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly OathService _oaths;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ConfigService _config;
    private readonly PushNotificationService _push;

    public GhostingService(AppDbContext db, ScoreService score, OathService oaths, SupabaseBroadcastService broadcast, ConfigService config, PushNotificationService push)
    {
        _db = db;
        _score = score;
        _oaths = oaths;
        _broadcast = broadcast;
        _config = config;
        _push = push;
    }

    public async Task<bool> CheckAsync(Match match)
    {
        if (!IsStale(match)) return false;

        if (!await TryGhostAsync(match)) return false;

        var atFault = await GetPenalisableGhostAsync(match);
        if (atFault.HasValue)
            await _score.AwardManyAsync([(atFault.Value, "GhostPenalty")]);

        if (atFault.HasValue) await _oaths.RefreshAsync(atFault.Value);

        await BroadcastGhostedAsync(match.Id, atFault);
        await NotifyGhostedAsync(match, atFault);

        return true;
    }

    /// <summary>
    /// Both sides learn the thread closed, but not in the same words: the ghosted party that it is
    /// over, the ghoster that their silence cost them score and standing. They used to get the
    /// identical neutral line, so the penalty landed with no explanation attached to it anywhere.
    /// </summary>
    public async Task NotifyGhostedAsync(Match match, Guid? atFaultUserId = null)
    {
        var data = new Dictionary<string, object> { ["matchId"] = match.Id.ToString() };
        foreach (var participant in new[] { match.InitiatorId, match.ReceiverId })
        {
            var kind = participant == atFaultUserId ? PushKind.MatchGhostedByYou : PushKind.MatchGhosted;
            await _push.NotifyUserAsync(participant, kind, data);
        }
    }

    public async Task<bool> TryGhostAsync(Match match)
    {
        // Freeze at the level the pair had actually reached, never below the floor every match is
        // created with. Reading message count alone stripped that floor off a short conversation
        // whenever reveal.level1.messages was tuned above 1, so ghosting *lowered* the reveal.
        int frozenLevel = Math.Max(
            match.RevealLevel, RevealService.LevelForMessageCount(_config, match.MessageCount));
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
    public TimeSpan StaleAfter => TimeSpan.FromHours(Math.Max(1, _config.GetNumber("ghosting.stale_hours", 48)));

    public bool IsStale(Match match) =>
        match.Status == "Active" && match.LastMessageAt.HasValue &&
        DateTime.UtcNow - match.LastMessageAt.Value > StaleAfter;

    public static Guid? GetGhostAtFaultUserId(Match match) =>
        match.LastMessageSenderId is null ? null :
        match.LastMessageSenderId == match.InitiatorId ? match.ReceiverId : match.InitiatorId;

    /// <summary>
    /// The party who owes a penalty for the silence, or null when nobody does. A match is created
    /// without the target's consent, so a recipient who never sent a single message never entered
    /// the conversation — their silence is disinterest, not ghosting. Docking it let a stranger
    /// drain a victim's score by matching them, sending one message and waiting out the window.
    /// Only someone who spoke and then stopped has abandoned anything.
    /// </summary>
    public async Task<Guid?> GetPenalisableGhostAsync(Match match)
    {
        var atFault = GetGhostAtFaultUserId(match);
        if (atFault is null) return null;

        bool everSpoke = await _db.Messages
            .AnyAsync(m => m.MatchId == match.Id && m.SenderId == atFault.Value);
        return everSpoke ? atFault : null;
    }
}
