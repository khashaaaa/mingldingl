namespace MinglDingl.Engine.Tests.Integration;

public class ScoreServiceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task ApplyReputationPenaltyAsync_DocksReputationOnly_LeavesTotalScoreUnchanged()
    {
        var user = NewCompleteUser();
        user.TotalScore = 100;
        user.ReputationScore = 1.0m;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var service = new ScoreService(Db, new ConfigService());
        var newReputation = await service.ApplyReputationPenaltyAsync(user.Id, "RepeatedNoShowPenalty");

        Assert.Equal(0.9m, newReputation);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(user.Id);
        Assert.Equal(0.9m, reloaded!.ReputationScore);
        Assert.Equal(100, reloaded.TotalScore); // unchanged — this is the whole point of the new method

        var events = Db.ScoreEvents.Where(e => e.UserId == user.Id && e.EventType == "RepeatedNoShowPenalty").ToList();
        Assert.Single(events);
        Assert.Equal(0, events[0].Delta); // no TotalScore delta — the audit row still exists for the stats/history views
    }

    [Fact]
    public async Task ApplyReputationPenaltyAsync_NeverGoesBelowZero()
    {
        var user = NewCompleteUser();
        user.ReputationScore = 0.05m;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var service = new ScoreService(Db, new ConfigService());
        var newReputation = await service.ApplyReputationPenaltyAsync(user.Id, "RepeatedNoShowPenalty");

        Assert.Equal(0m, newReputation);
    }
}
