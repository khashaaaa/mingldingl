using Microsoft.EntityFrameworkCore;

/// <summary>
/// The seats at a user's fire: how many active matches they may hold at once. A swipe app lets a
/// queue grow without end; here a new summons needs a free seat, and a seat is freed only by ending
/// a thread — kindly (unmatch), by retiring together, or by ghosting and paying for it.
/// Fated Threads and Town Square matches are made by events the user already chose, so they are
/// never refused; they simply fill seats like any other.
/// </summary>
public class PartyService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;

    public PartyService(AppDbContext db, ConfigService config) { _db = db; _config = config; }

    public bool Enabled => _config.GetBool("party.enabled", true);

    public static int SeatsFor(ConfigService config, string gemTier) =>
        Math.Max(1, (int)config.GetNumber("party.seats.base", 4))
        + Math.Max(0, (int)config.GetNumber("party.seats.per_tier", 1)) * ScoreService.TierIndex(gemTier);

    public int Seats(string gemTier) => SeatsFor(_config, gemTier);

    public Task<int> UsedAsync(Guid userId) =>
        _db.Matches.CountAsync(m => m.Status == "Active" && (m.InitiatorId == userId || m.ReceiverId == userId));

    /// <summary>Active match counts for many users in one query, for filtering a discover page.</summary>
    public async Task<Dictionary<Guid, int>> UsedByAsync(IReadOnlyCollection<Guid> userIds)
    {
        if (userIds.Count == 0) return [];
        var active = _db.Matches.Where(m => m.Status == "Active");
        var rows = await active.Where(m => userIds.Contains(m.InitiatorId)).Select(m => m.InitiatorId)
            .Concat(active.Where(m => userIds.Contains(m.ReceiverId)).Select(m => m.ReceiverId))
            .GroupBy(id => id)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToListAsync();
        return rows.ToDictionary(r => r.Id, r => r.Count);
    }

    public async Task<bool> IsFullAsync(User user) =>
        Enabled && await UsedAsync(user.Id) >= Seats(user.GemTier);
}
