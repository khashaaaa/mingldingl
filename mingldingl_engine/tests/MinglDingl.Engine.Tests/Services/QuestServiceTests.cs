using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests;

public class QuestServiceTests
{
    private static QuestService CreateService(ConfigService? config = null) =>
        new(null!, null!, config ?? new ConfigService(), NullLogger<QuestService>.Instance);

    [Fact]
    public void QuestsForDate_ReturnsThreeDistinctQuests()
    {
        var quests = CreateService().QuestsForDate(new DateTime(2026, 7, 4));
        Assert.Equal(3, quests.Count);
        Assert.Equal(3, quests.Select(q => q.Id).Distinct().Count());
    }

    [Fact]
    public void QuestsForDate_IsDeterministicForSameDate()
    {
        var a = CreateService().QuestsForDate(new DateTime(2026, 7, 4));
        var b = CreateService().QuestsForDate(new DateTime(2026, 7, 4, 23, 59, 0));
        Assert.Equal(a.Select(q => q.Id), b.Select(q => q.Id));
    }

    [Fact]
    public void QuestsForDate_RotatesAcrossDays()
    {
        var a = CreateService().QuestsForDate(new DateTime(2026, 7, 4));
        var b = CreateService().QuestsForDate(new DateTime(2026, 7, 5));
        Assert.NotEqual(a[0].Id, b[0].Id);
    }

    [Fact]
    public void AllQuests_HaveUniqueIdsAndActions()
    {
        Assert.Equal(QuestService.AllQuests.Count, QuestService.AllQuests.Select(q => q.Id).Distinct().Count());
        Assert.All(QuestService.AllQuests, q => Assert.True(q.Target >= 1 && q.Xp > 0));
    }

    [Fact]
    public void EffectiveQuests_NoConfig_MatchesDefaults()
    {
        var effective = CreateService().EffectiveQuests();
        Assert.Equal(QuestService.AllQuests, effective);
    }

    [Fact]
    public void EffectiveQuests_XpAndTargetOverriddenInConfig_UseConfigValues()
    {
        var config = new ConfigService();
        config.Set("quest.q_messages.xp", "99");
        config.Set("quest.q_messages.target", "8");

        var messages = CreateService(config).EffectiveQuests().Single(q => q.Id == "q_messages");

        Assert.Equal(99, messages.Xp);
        Assert.Equal(8, messages.Target);
        Assert.Equal("quest_exchange_words", messages.NameKey);
    }

    [Fact]
    public void EffectiveQuests_TargetBelowOne_ClampsToOne()
    {
        var config = new ConfigService();
        config.Set("quest.q_quiz.target", "0");
        Assert.Equal(1, CreateService(config).EffectiveQuests().Single(q => q.Id == "q_quiz").Target);
    }
}
