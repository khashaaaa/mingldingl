using Microsoft.EntityFrameworkCore;

public class OathService
{
    public static readonly IReadOnlySet<string> ValidOaths =
        new HashSet<string>(StringComparer.Ordinal) { "Bond", "Fate", "Kinship" };

    private static readonly string[] OathLadder = ["Kinship", "Fate", "Bond"];

    public static int? Affinity(string? a, string? b)
    {
        if (a is null || b is null) return null;
        int ia = Array.IndexOf(OathLadder, a);
        int ib = Array.IndexOf(OathLadder, b);
        if (ia < 0 || ib < 0) return null;
        return 2 - Math.Abs(ia - ib);
    }

    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    private readonly ScoreService _score;
    private readonly MilestoneService _milestones;
    private readonly HonourService _honours;

    public OathService(AppDbContext db, ConfigService config, ScoreService score,
                       MilestoneService milestones, HonourService honours)
    {
        _db = db;
        _config = config;
        _score = score;
        _milestones = milestones;
        _honours = honours;
    }

    public async Task<User?> SwearAsync(Guid userId, string oath)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return null;

        user.Oath = oath;
        user.OathSwornAt = DateTime.UtcNow;
        user.OathProven = false;
        await _db.SaveChangesAsync();
        return user;
    }

    public async Task<bool> RefreshAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null || user.Oath is null || user.OathSwornAt is null) return false;

        var since = user.OathSwornAt.Value;
        bool qualifies = await QualifiesAsync(userId, since);

        if (!qualifies)
        {
            if (user.OathProven)
            {
                user.OathProven = false;
                await _db.SaveChangesAsync();
            }
            return false;
        }

        if (user.OathProven) return false;

        user.OathProven = true;
        await _db.SaveChangesAsync();

        bool alreadyPaid = await _db.UserMilestones
            .AnyAsync(m => m.UserId == userId && m.MilestoneId == "oath_proven");
        if (!alreadyPaid)
        {
            await _milestones.AchieveAsync(userId, "oath_proven");
            await _score.AwardAsync(userId, "OathProven");
            await _honours.GrantAsync(userId, "title_oathkeeper", "oath_proven");
        }

        return true;
    }

    private async Task<bool> QualifiesAsync(Guid userId, DateTime since)
    {
        bool ghosted = await _db.ScoreEvents
            .AnyAsync(e => e.UserId == userId && e.EventType == "GhostPenalty" && e.CreatedAt >= since);
        if (ghosted) return false;

        int required = RequiredEncounters();
        int encounters = await CountDistinctEncountersAsync(userId, since);
        return encounters >= required;
    }

    private async Task<int> CountDistinctEncountersAsync(Guid userId, DateTime since)
    {
        return await _db.DateConfirmations
            .Where(c => c.CompletedAt != null && c.CompletedAt >= since
                && _db.Matches.Any(m => m.Id == c.MatchId
                    && (m.InitiatorId == userId || m.ReceiverId == userId)))
            .Select(c => c.MatchId)
            .Distinct()
            .CountAsync();
    }

    private int RequiredEncounters() => (int)_config.GetNumber("oath.proven.encounters", 2);

    public async Task<(int? Held, int? Needed)> GetProgressAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is null || user.Oath is null || user.OathSwornAt is null) return (null, null);

        int held = await CountDistinctEncountersAsync(userId, user.OathSwornAt.Value);
        return (held, RequiredEncounters());
    }
}
