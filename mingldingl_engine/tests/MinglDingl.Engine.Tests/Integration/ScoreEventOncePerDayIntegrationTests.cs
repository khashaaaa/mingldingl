using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class ScoreEventOncePerDayIntegrationTests : IntegrationTestBase
{
    [Theory]
    [InlineData("QuestChest")]
    [InlineData("DailyLogin")]
    public async Task AwardWithDeltaAsync_SecondSameDayCallForGuardedEventType_ThrowsUniqueViolation(string eventType)
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        await score.AwardWithDeltaAsync(user.Id, eventType, 30);

        var ex = await Record.ExceptionAsync(() => score.AwardWithDeltaAsync(user.Id, eventType, 30));

        var dbEx = Assert.IsType<DbUpdateException>(ex);
        Assert.True(OncePerDayScoreEventGuard.IsViolation(dbEx));
    }

    [Fact]
    public async Task AwardWithDeltaAsync_SecondSameDayCallForUnguardedEventType_DoesNotThrow()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        await score.AwardWithDeltaAsync(user.Id, "QuestComplete", 15);

        var ex = await Record.ExceptionAsync(() => score.AwardWithDeltaAsync(user.Id, "QuestComplete", 15));

        Assert.Null(ex);
    }
}
