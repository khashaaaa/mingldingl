using Microsoft.EntityFrameworkCore;

public record QuestDef(string Id, string NameKey, string Action, int Target, int Xp);

public class QuestService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    public QuestService(AppDbContext db, ScoreService score) { _db = db; _score = score; }

    public static readonly IReadOnlyList<QuestDef> AllQuests =
    [
        new("q_summons",    "quest_send_summons",   "summons",    1, 15),
        new("q_icebreaker", "quest_break_ice",      "icebreaker", 1, 20),
        new("q_messages",   "quest_exchange_words", "message",    5, 15),
        new("q_quiz",       "quest_trial",          "quiz",       1, 15),
        new("q_video",      "quest_face_flame",     "video",      1, 20),
        new("q_pledge",     "quest_pledge",         "pledge",     1, 25),
    ];

    public static List<QuestDef> QuestsForDate(DateTime dateUtc)
    {
        int day = (int)(dateUtc.Date - new DateTime(2026, 1, 1)).TotalDays;
        int start = ((day % AllQuests.Count) + AllQuests.Count) % AllQuests.Count;
        return [AllQuests[start], AllQuests[(start + 1) % AllQuests.Count], AllQuests[(start + 2) % AllQuests.Count]];
    }

    // Best-effort: called from action handlers; a quest-tracking failure must never fail the action.
    // Returns the quest XP actually awarded by this call (0 if the day has no
    // matching quest, it's already complete, or this increment didn't finish
    // it) — callers report this back to the client so the response's total
    // reflects the real award instead of a guessed constant.
    public async Task<int> IncrementAsync(Guid userId, string action)
    {
        try
        {
            var today = DateTime.UtcNow.Date;
            var quest = QuestsForDate(today).FirstOrDefault(q => q.Action == action);
            if (quest is null) return 0;

            var row = await _db.UserDailyQuests.FirstOrDefaultAsync(r =>
                r.UserId == userId && r.QuestDate == today && r.QuestId == quest.Id);
            if (row is null)
            {
                row = new UserDailyQuest { UserId = userId, QuestDate = today, QuestId = quest.Id };
                _db.UserDailyQuests.Add(row);
            }
            if (row.CompletedAt is not null) return 0;

            row.Progress = Math.Min(quest.Target, row.Progress + 1);
            if (row.Progress >= quest.Target)
            {
                row.CompletedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                await _score.AwardWithDeltaAsync(userId, "QuestComplete", quest.Xp);
                return quest.Xp;
            }

            await _db.SaveChangesAsync();
            return 0;
        }
        catch
        {
            // Best-effort by design — but never leave poisoned (Added/Modified)
            // entities tracked on the shared scoped DbContext for later saves.
            _db.ChangeTracker.Clear();
            return 0;
        }
    }
}
