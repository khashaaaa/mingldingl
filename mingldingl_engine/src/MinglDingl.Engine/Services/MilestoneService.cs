using Microsoft.EntityFrameworkCore;

public record MilestoneDef(string Id, string NameKey, int Xp);

public class MilestoneService
{
    private readonly AppDbContext _db;
    public MilestoneService(AppDbContext db) => _db = db;

    public static readonly IReadOnlyList<MilestoneDef> Defs =
    [
        new("first_match",             "milestone_first_match",  25),
        new("ten_messages_one_match",  "milestone_ten_messages", 30),
        new("first_pledged_encounter", "milestone_first_pledge", 50),
        new("first_video_call",        "milestone_first_video",  40),
    ];

    // Best-effort: never fail the triggering action.
    public async Task AchieveAsync(Guid userId, string milestoneId)
    {
        try
        {
            if (!Defs.Any(d => d.Id == milestoneId)) return;
            bool exists = await _db.UserMilestones.AnyAsync(m => m.UserId == userId && m.MilestoneId == milestoneId);
            if (exists) return;
            _db.UserMilestones.Add(new UserMilestone { UserId = userId, MilestoneId = milestoneId });
            await _db.SaveChangesAsync();
        }
        catch
        {
            // Best-effort by design — but never leave poisoned (Added/Modified)
            // entities tracked on the shared scoped DbContext for later saves.
            _db.ChangeTracker.Clear();
        }
    }
}
