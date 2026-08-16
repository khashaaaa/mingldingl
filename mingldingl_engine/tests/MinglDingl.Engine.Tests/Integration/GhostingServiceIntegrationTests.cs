namespace MinglDingl.Engine.Tests.Integration;

// Verifies the fairness fix end-to-end against real Postgres: only whoever
// didn't send the last message (the one who owes a reply) takes the
// GhostPenalty score/reputation hit, not both participants.
public class GhostingServiceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task CheckAsync_StaleMatch_PenalizesOnlyWhoeverDidNotSendLastMessage()
    {
        var replier = NewCompleteUser();   // sent the last message — waiting on a reply
        var silent = NewCompleteUser();    // never replied — at fault
        replier.TotalScore = 50;
        silent.TotalScore = 50;            // non-zero baseline so the penalty is visible past the Math.Max(0, ...) floor
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var ghosting = new GhostingService(Db, new ScoreService(Db, new ConfigService()));
        var result = await ghosting.CheckAsync(match);

        Assert.True(result);
        Assert.Equal("Ghosted", match.Status);

        await Db.Entry(replier).ReloadAsync();
        await Db.Entry(silent).ReloadAsync();

        Assert.Equal(50, replier.TotalScore);
        Assert.Equal(1.0m, replier.ReputationScore);

        Assert.Equal(35, silent.TotalScore);
        Assert.Equal(0.9m, silent.ReputationScore);
    }

    [Fact]
    public async Task CheckAsync_LegacyMatchWithNoRecordedSender_SkipsPenaltyEntirely()
    {
        var userA = NewCompleteUser();
        var userB = NewCompleteUser();
        Db.Users.AddRange(userA, userB);

        var match = new Match
        {
            InitiatorId = userA.Id,
            ReceiverId = userB.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = null,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var ghosting = new GhostingService(Db, new ScoreService(Db, new ConfigService()));
        var result = await ghosting.CheckAsync(match);

        Assert.True(result);
        Assert.Equal("Ghosted", match.Status);

        await Db.Entry(userA).ReloadAsync();
        await Db.Entry(userB).ReloadAsync();

        Assert.Equal(0, userA.TotalScore);
        Assert.Equal(0, userB.TotalScore);
    }
}
