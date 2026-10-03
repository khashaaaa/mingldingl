using Microsoft.EntityFrameworkCore;

/// <summary>This week's shared trial for one match, as one participant sees it.</summary>
public record BondTrial(
    string Kind, DateTime WeekStart, DateTime EndsAt, int Target,
    int MyProgress, int TheirProgress, bool Complete, bool Claimed, int Reward);

/// <summary>
/// One trial per match per week that only the pair together can pass. "exchange" asks each side
/// for its own share of the conversation, so one person cannot carry it; "rite" asks the pair to
/// hold the Flame Rite. Which one a week gets is fixed by the match and the week, so both sides
/// always see the same trial, and it is decided from state at the start of the week so that
/// passing the rite on Tuesday cannot swap Tuesday's trial out from under them.
/// The reward is paid to both, once, when either claims it.
/// </summary>
public class BondTrialService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    private readonly ScoreService _score;

    public BondTrialService(AppDbContext db, ConfigService config, ScoreService score)
    {
        _db = db; _config = config; _score = score;
    }

    public bool Enabled => _config.GetBool("trial.enabled", true);

    /// <summary>Monday 00:00 UTC of the week containing <paramref name="utc"/>.</summary>
    public static DateTime WeekStartOf(DateTime utc)
    {
        var day = utc.Date;
        int sinceMonday = ((int)day.DayOfWeek + 6) % 7;
        return DateTime.SpecifyKind(day.AddDays(-sinceMonday), DateTimeKind.Utc);
    }

    public static string KindFor(Match match, DateTime weekStart, bool videoEnabled)
    {
        bool riteOpen = videoEnabled && (match.FlameRiteCompletedAt is null || match.FlameRiteCompletedAt >= weekStart);
        if (!riteOpen) return "exchange";
        var hash = System.Security.Cryptography.SHA256.HashData(
            [.. match.Id.ToByteArray(), .. BitConverter.GetBytes(weekStart.Ticks)]);
        return hash[0] % 2 == 0 ? "rite" : "exchange";
    }

    public async Task<BondTrial> GetAsync(Match match, Guid viewerId, DateTime? now = null)
    {
        var weekStart = WeekStartOf(now ?? DateTime.UtcNow);
        var kind = KindFor(match, weekStart, _config.GetBool("video.enabled", true));
        int target, mine, theirs;
        if (kind == "rite")
        {
            target = 1;
            mine = theirs = match.FlameRiteCompletedAt is DateTime done && done >= weekStart ? 1 : 0;
        }
        else
        {
            target = Math.Max(1, (int)_config.GetNumber("trial.exchange.messages", 5));
            var counts = await _db.Messages.AsNoTracking()
                .Where(m => m.MatchId == match.Id && m.CreatedAt >= weekStart)
                .GroupBy(m => m.SenderId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync();
            var otherId = match.OtherParticipant(viewerId);
            mine = counts.FirstOrDefault(c => c.Key == viewerId)?.Count ?? 0;
            theirs = counts.FirstOrDefault(c => c.Key == otherId)?.Count ?? 0;
        }

        bool claimed = await _db.BondTrialClaims.AnyAsync(c => c.MatchId == match.Id && c.WeekStart == weekStart);
        return new BondTrial(kind, weekStart, weekStart.AddDays(7), target,
            Math.Min(mine, target), Math.Min(theirs, target),
            mine >= target && theirs >= target, claimed, _score.Delta("BondTrialDone"));
    }

    /// <summary>
    /// Pays both sides once. The claim row is the lock: inserting it under the composite key means a
    /// second claim — the other person tapping at the same moment — fails on the key, not on a read.
    /// </summary>
    public async Task<BondTrial> ClaimAsync(Match match, Guid viewerId)
    {
        var trial = await GetAsync(match, viewerId);
        if (trial.Claimed) throw DomainException.Conflict("This week's trial has already been claimed", "trial.already_claimed");
        if (!trial.Complete) throw new DomainException("This week's trial is not complete yet", "trial.incomplete");

        await _db.InTransactionAsync(async () =>
        {
            int inserted = await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO "BondTrialClaims" ("MatchId", "WeekStart", "Kind", "ClaimedAt")
                VALUES ({match.Id}, {trial.WeekStart}, {trial.Kind}, {DateTime.UtcNow})
                ON CONFLICT DO NOTHING
                """);
            if (inserted == 0) throw DomainException.Conflict("This week's trial has already been claimed", "trial.already_claimed");
            foreach (var userId in new[] { match.InitiatorId, match.ReceiverId })
                await _score.AwardAsync(userId, "BondTrialDone", match.Id);
        });

        return trial with { Claimed = true };
    }
}
