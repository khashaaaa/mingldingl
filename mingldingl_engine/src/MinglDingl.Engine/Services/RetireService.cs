using Microsoft.EntityFrameworkCore;

public enum RetireOutcome { Proposed, Withdrawn, Retired }

/// <summary>
/// Retiring together: the one ending the app wants people to reach. One side proposes, the other
/// accepts, and the match closes as <c>Completed</c>; both accounts pause out of discovery and both
/// earn Hearthbound. Only a pair that has completed a pledged encounter may retire — the honour is
/// for people who met, not for two accounts that agreed to say so.
/// </summary>
public class RetireService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    private readonly HonourService _honours;
    private readonly SupabaseBroadcastService _broadcast;

    public RetireService(AppDbContext db, ConfigService config, HonourService honours, SupabaseBroadcastService broadcast)
    {
        _db = db; _config = config; _honours = honours; _broadcast = broadcast;
    }

    public bool Enabled => _config.GetBool("retire.enabled", true);

    public Task<bool> HasCompletedEncounterAsync(Guid matchId) =>
        _db.DateConfirmations.AnyAsync(c => c.MatchId == matchId && c.CompletedAt != null);

    /// <summary>Proposes, or — when the other side already proposed — accepts.</summary>
    public async Task<RetireOutcome> ProposeOrAcceptAsync(Match match, Guid userId)
    {
        if (!Enabled) throw DomainException.NotFound("Retiring is not open", "retire.disabled");
        if (!await HasCompletedEncounterAsync(match.Id))
            throw DomainException.Forbidden("Only a pair that has met can retire together", "retire.no_encounter");

        var now = DateTime.UtcNow;
        // Claimed in SQL so a proposal racing an acceptance cannot both win: the propose only lands
        // on a match nobody has proposed on, the accept only on one the *other* side proposed.
        int proposed = await _db.Matches
            .Where(m => m.Id == match.Id && m.Status == "Active" && m.RetireProposedById == null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.RetireProposedById, userId).SetProperty(m => m.RetireProposedAt, now));
        if (proposed > 0)
        {
            await _broadcast.BroadcastToUsersAsync([match.InitiatorId, match.ReceiverId], "retire_proposed",
                new { matchId = match.Id, userId });
            return RetireOutcome.Proposed;
        }

        bool accepted = await _db.InTransactionAsync(async () =>
        {
            int closed = await _db.Matches
                .Where(m => m.Id == match.Id && m.Status == "Active"
                    && m.RetireProposedById != null && m.RetireProposedById != userId)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.Status, "Completed"));
            if (closed == 0) return false;

            var pair = new[] { match.InitiatorId, match.ReceiverId };
            await _db.Users.Where(u => pair.Contains(u.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.RetiredAt, now).SetProperty(u => u.IsPaused, true));
            return true;
        });

        if (!accepted)
        {
            // Either this side already proposed (a repeat tap is not an error) or the match is gone.
            var current = await _db.Matches.AsNoTracking().FirstAsync(m => m.Id == match.Id);
            if (current.Status == "Active" && current.RetireProposedById == userId) return RetireOutcome.Proposed;
            throw DomainException.Conflict("This match can no longer retire", "retire.not_active");
        }

        match.Status = "Completed";
        await _honours.GrantAsync(match.InitiatorId, "title_hearthbound", "retired");
        await _honours.GrantAsync(match.ReceiverId, "title_hearthbound", "retired");
        await _broadcast.BroadcastToUsersAsync([match.InitiatorId, match.ReceiverId], "match_status_changed",
            new { matchId = match.Id, status = "Completed", userId });
        return RetireOutcome.Retired;
    }

    /// <summary>Withdraws a proposal, or declines the other side's — either way it is cleared.</summary>
    public async Task WithdrawAsync(Match match, Guid userId)
    {
        int cleared = await _db.Matches
            .Where(m => m.Id == match.Id && m.Status == "Active" && m.RetireProposedById != null)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.RetireProposedById, (Guid?)null).SetProperty(m => m.RetireProposedAt, (DateTime?)null));
        if (cleared > 0)
            await _broadcast.BroadcastToUsersAsync([match.InitiatorId, match.ReceiverId], "retire_proposed",
                new { matchId = match.Id, userId, withdrawn = true });
    }
}
