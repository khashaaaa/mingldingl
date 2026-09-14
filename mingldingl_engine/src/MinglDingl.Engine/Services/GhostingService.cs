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

        var (ghosted, atFault) = await GhostAndPenaliseAsync(match);
        if (!ghosted) return false;

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

    /// <summary>
    /// Closes the match and docks whoever owes for it as one unit. The status used to commit first,
    /// so a failure between the two left a Ghosted match nobody was ever penalised for: the sweep
    /// only looks at Active matches and never came back to it. Rolled back together, the next sweep
    /// simply tries again. Push and broadcast stay with the caller, after the commit.
    /// </summary>
    public async Task<(bool Ghosted, Guid? AtFault)> GhostAndPenaliseAsync(Match match)
    {
        var (ghosted, atFault, frozenLevel) = await _db.InTransactionAsync(async () =>
        {
            int? level = await TryGhostInDatabaseAsync(match);
            if (level is null) return (false, (Guid?)null, 0);

            var penalised = await GetPenalisableGhostAsync(match);
            if (penalised.HasValue)
                await _score.AwardManyAsync([(penalised.Value, "GhostPenalty")]);
            return (true, penalised, level.Value);
        });

        if (ghosted) ApplyGhosted(match, frozenLevel);
        return (ghosted, atFault);
    }

    /// <summary>
    /// Mirrors the ghosting onto the caller's copy without queuing it as a change: the row is already
    /// written, and a tracked copy left Modified would write it again on someone else's save.
    /// </summary>
    private void ApplyGhosted(Match match, int frozenLevel)
    {
        match.Status = "Ghosted";
        match.RevealLevel = frozenLevel;
        var entry = _db.Entry(match);
        if (entry.State == EntityState.Detached) return;

        // Clearing IsModified alone reverts the value to the original, so the original moves first.
        entry.Property(m => m.Status).OriginalValue = "Ghosted";
        entry.Property(m => m.Status).IsModified = false;
        entry.Property(m => m.RevealLevel).OriginalValue = frozenLevel;
        entry.Property(m => m.RevealLevel).IsModified = false;
    }

    private async Task<int?> TryGhostInDatabaseAsync(Match match)
    {
        // Freeze at the level the pair had actually reached, never below the floor every match is
        // created with. Reading message count alone stripped that floor off a short conversation
        // whenever reveal.level1.messages was tuned above 1, so ghosting *lowered* the reveal.
        // The count is the mutual one for the same reason GetRevealLevel uses it: the raw total let
        // a monologue unlock a stranger's profile, and freezing on it made ghosting the back door —
        // 30 messages into silence, wait out the window, and the frozen level was the full reveal.
        int frozenLevel = Math.Max(
            match.RevealLevel,
            RevealService.LevelForMessageCount(_config, RevealService.MutualMessageCount(match)));
        // Only the conversation as it was read. A reply landing between the read and this write moves
        // LastMessageAt (and may change who spoke last), and ghosting on the stale copy closed a live
        // thread and blamed the person who had just answered.
        var loadedAt = match.LastMessageAt;
        var loadedSender = match.LastMessageSenderId;
        var query = _db.Matches.Where(m => m.Id == match.Id && m.Status == "Active"
            && m.LastMessageSenderId == loadedSender);
        // At-or-before rather than equal: a copy built in memory carries sub-microsecond ticks the
        // column truncated away on save.
        query = loadedAt is DateTime at
            ? query.Where(m => m.LastMessageAt != null && m.LastMessageAt <= at)
            : query.Where(m => m.LastMessageAt == null);

        int rowsAffected = await query.ExecuteUpdateAsync(s => s
            .SetProperty(m => m.Status, "Ghosted")
            .SetProperty(m => m.RevealLevel, frozenLevel));
        return rowsAffected == 0 ? null : frozenLevel;
    }

    public Task BroadcastGhostedAsync(Guid matchId, Guid? atFaultUserId) =>
        _broadcast.BroadcastAsync("app-nudges", "match_status_changed",
            new { matchId, status = "Ghosted", userId = atFaultUserId });

    /// <summary>Exposed so the sweep can push the same cutoff into SQL instead of filtering in memory.</summary>
    public TimeSpan StaleAfter => StaleAfterFor(_config);

    /// <summary>
    /// How long a match nobody has said anything in stays open. Its own window, and a longer one:
    /// a summons the other person has not answered yet is not the same as a conversation that
    /// stopped, and the target never asked for it.
    /// </summary>
    public TimeSpan UnansweredAfter => UnansweredAfterFor(_config);

    /// <summary>Static so callers with only a <see cref="ConfigService"/> (no live match to check) can
    /// read the same window — <c>EngagementController</c> serves it to the app without a <c>GhostingService</c>.</summary>
    public static TimeSpan StaleAfterFor(ConfigService config) =>
        TimeSpan.FromHours(Math.Max(1, config.GetNumber("ghosting.stale_hours", 48)));

    public static TimeSpan UnansweredAfterFor(ConfigService config) =>
        TimeSpan.FromHours(Math.Max(1, config.GetNumber("ghosting.unanswered_hours", 168)));

    /// <summary>
    /// Both clocks a match can run out on. Reading only <see cref="Match.LastMessageAt"/> left a
    /// match where nobody ever spoke Active forever — permanently blocking that pair from ever
    /// matching again, since PairAlreadyMatchedAsync counts a row of any status, and holding a
    /// daily slot the initiator never got anything for.
    /// </summary>
    public bool IsStale(Match match) =>
        match.Status == "Active" && (
            match.LastMessageAt.HasValue
                ? DateTime.UtcNow - match.LastMessageAt.Value > StaleAfter
                : DateTime.UtcNow - match.CreatedAt > UnansweredAfter);

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
