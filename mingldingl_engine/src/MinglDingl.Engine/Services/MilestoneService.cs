using Microsoft.EntityFrameworkCore;

public record MilestoneDef(string Id, string NameKey, int Xp);

public class MilestoneService
{
    private readonly AppDbContext _db;
    private readonly ILogger<MilestoneService> _logger;
    public MilestoneService(AppDbContext db, ILogger<MilestoneService> logger) { _db = db; _logger = logger; }

    public static readonly IReadOnlyList<MilestoneDef> Defs =
    [
        new("first_match",             "milestone_first_match",     25),
        new("first_icebreaker",        "milestone_first_icebreaker", 20),
        new("first_quiz",              "milestone_first_quiz",      20),
        new("ten_messages_one_match",  "milestone_ten_messages",    30),
        new("first_pledged_encounter", "milestone_first_pledge",    50),
        new("first_video_call",        "milestone_first_video",     40),
        new("oath_proven",             "milestone_oath_proven",     40),
    ];

    public async Task AchieveAsync(Guid userId, string milestoneId)
    {
        UserMilestone? added = null;
        try
        {
            if (!Defs.Any(d => d.Id == milestoneId)) return;
            bool exists = await _db.UserMilestones.AnyAsync(m => m.UserId == userId && m.MilestoneId == milestoneId);
            if (exists) return;
            added = new UserMilestone { UserId = userId, MilestoneId = milestoneId };
            _db.UserMilestones.Add(added);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Milestone grant of {MilestoneId} swallowed a failure for user {UserId}", milestoneId, userId);

            // Detach only what this method added. Clearing the whole tracker would silently throw
            // away unsaved work belonging to whoever else is sharing this scoped context.
            if (added is not null) _db.Entry(added).State = EntityState.Detached;
        }
    }
}
