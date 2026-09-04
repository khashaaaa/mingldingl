using Microsoft.EntityFrameworkCore;

public record QuestDef(string Id, string NameKey, string Action, int Target, int Xp);

public class QuestService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly ConfigService _config;
    private readonly ILogger<QuestService> _logger;
    public QuestService(AppDbContext db, ScoreService score, ConfigService config, ILogger<QuestService> logger)
    {
        _db = db;
        _score = score;
        _config = config;
        _logger = logger;
    }

    public static readonly IReadOnlyList<QuestDef> AllQuests =
    [
        new("q_summons",    "quest_send_summons",   "summons",    1, 15),
        new("q_icebreaker", "quest_break_ice",      "icebreaker", 1, 20),
        new("q_messages",   "quest_exchange_words", "message",    5, 15),
        new("q_quiz",       "quest_trial",          "quiz",       1, 15),
        new("q_video",      "quest_face_flame",     "video",      1, 20),
        new("q_pledge",     "quest_pledge",         "pledge",     1, 25),
    ];

    /// <summary>The defaults above with each quest's XP and target read from admin config.</summary>
    public IReadOnlyList<QuestDef> EffectiveQuests() =>
        AllQuests.Select(q => q with
        {
            Target = Math.Max(1, (int)_config.GetNumber($"quest.{q.Id}.target", q.Target)),
            Xp = Math.Max(0, (int)_config.GetNumber($"quest.{q.Id}.xp", q.Xp)),
        }).ToList();

    public List<QuestDef> QuestsForDate(DateTime dateUtc)
    {
        var quests = EffectiveQuests();
        int day = (int)(dateUtc.Date - new DateTime(2026, 1, 1)).TotalDays;
        int start = ((day % quests.Count) + quests.Count) % quests.Count;
        return [quests[start], quests[(start + 1) % quests.Count], quests[(start + 2) % quests.Count]];
    }

    public async Task<int> IncrementAsync(Guid userId, string action)
    {
        UserDailyQuest? row = null;
        try
        {
            var today = DateTime.UtcNow.Date;
            var quest = QuestsForDate(today).FirstOrDefault(q => q.Action == action);
            if (quest is null) return 0;

            row = await _db.UserDailyQuests.FirstOrDefaultAsync(r =>
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Quest tracking swallowed a failure for user {UserId} (action {Action}); no quest progress recorded", userId, action);

            // Detach only what this method touched. Clearing the whole tracker would silently throw
            // away unsaved work belonging to whoever else is sharing this scoped context.
            if (row is not null) _db.Entry(row).State = EntityState.Detached;
            return 0;
        }
    }
}
