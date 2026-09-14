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
        try
        {
            var today = DateTime.UtcNow.Date;
            var quest = QuestsForDate(today).FirstOrDefault(q => q.Action == action);
            if (quest is null) return 0;

            // One upsert moves the progress and decides completion. Read-modify-write lost ticks
            // between concurrent actions, let both racers see the quest finish and pay its XP twice,
            // and turned a concurrent first insert into a swallowed unique violation. The row comes
            // back only while it was still incomplete, so a non-null CompletedAt is the transition.
            var now = DateTime.UtcNow;
            int target = quest.Target;
            DateTime? completedOnInsert = target <= 1 ? now : null;

            return await _db.InTransactionAsync(async () =>
            {
                var completed = await _db.Database.SqlQuery<DateTime?>(
                    $"""
                    INSERT INTO "UserDailyQuests" ("Id", "UserId", "QuestDate", "QuestId", "Progress", "CompletedAt")
                    VALUES ({Guid.NewGuid()}, {userId}, {today}, {quest.Id}, 1, {completedOnInsert})
                    ON CONFLICT ("UserId", "QuestDate", "QuestId") DO UPDATE SET
                        "Progress" = LEAST({target}, "UserDailyQuests"."Progress" + 1),
                        "CompletedAt" = CASE WHEN "UserDailyQuests"."Progress" + 1 >= {target} THEN {now} ELSE NULL END
                    WHERE "UserDailyQuests"."CompletedAt" IS NULL
                    RETURNING "CompletedAt"
                    """).ToListAsync();

                if (completed.Count == 0 || completed[0] is null) return 0;

                await _score.AwardWithDeltaAsync(userId, "QuestComplete", quest.Xp);
                return quest.Xp;
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Quest tracking swallowed a failure for user {UserId} (action {Action}); no quest progress recorded", userId, action);
            return 0;
        }
    }
}
