namespace MinglDingl.Engine.Tests;

public class QuestServiceTests
{
    [Fact]
    public void QuestsForDate_ReturnsThreeDistinctQuests()
    {
        var quests = QuestService.QuestsForDate(new DateTime(2026, 7, 4));
        Assert.Equal(3, quests.Count);
        Assert.Equal(3, quests.Select(q => q.Id).Distinct().Count());
    }

    [Fact]
    public void QuestsForDate_IsDeterministicForSameDate()
    {
        var a = QuestService.QuestsForDate(new DateTime(2026, 7, 4));
        var b = QuestService.QuestsForDate(new DateTime(2026, 7, 4, 23, 59, 0));
        Assert.Equal(a.Select(q => q.Id), b.Select(q => q.Id));
    }

    [Fact]
    public void QuestsForDate_RotatesAcrossDays()
    {
        var a = QuestService.QuestsForDate(new DateTime(2026, 7, 4));
        var b = QuestService.QuestsForDate(new DateTime(2026, 7, 5));
        Assert.NotEqual(a[0].Id, b[0].Id);
    }

    [Fact]
    public void AllQuests_HaveUniqueIdsAndActions()
    {
        Assert.Equal(QuestService.AllQuests.Count, QuestService.AllQuests.Select(q => q.Id).Distinct().Count());
        Assert.All(QuestService.AllQuests, q => Assert.True(q.Target >= 1 && q.Xp > 0));
    }
}
