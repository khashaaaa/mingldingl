using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

// Exercises the ix_score_events_once_per_day partial unique index (migration
// 20260705044949_AddScoreEventsOncePerDayIndex) against real Postgres — the
// mechanism that closes the DailyLogin/QuestChest TOCTOU window described in
// the final review's race family (B.2). A true concurrent race (AnyAsync sees
// false on both callers, then the second INSERT conflicts) needs two
// overlapping live transactions to reproduce, which isn't reproducible in this
// harness's single rolled-back transaction per test. What's tested here is the
// actual safety net: the constraint fires on a same-day repeat, and
// OncePerDayScoreEventGuard correctly recognizes that failure so the two call
// sites can turn it into an idempotent response instead of a 500.
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
        // Control: the index only applies to DailyLogin/QuestChest, so an
        // unrelated repeatable-by-design event type (e.g. QuestComplete, fired
        // once per quest per day but not covered by this index) must be
        // unaffected.
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var score = new ScoreService(Db, new ConfigService());
        await score.AwardWithDeltaAsync(user.Id, "QuestComplete", 15);

        var ex = await Record.ExceptionAsync(() => score.AwardWithDeltaAsync(user.Id, "QuestComplete", 15));

        Assert.Null(ex);
    }
}
