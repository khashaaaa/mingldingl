using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class GhostingServiceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task CheckAsync_GhostScorePenaltyConfiguredToZero_StillDocksReputationAndRecordsTheGhost()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        replier.TotalScore = 50;
        silent.TotalScore = 50;
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

        var config = new ConfigService();
        config.Set("score.event.GhostPenalty", "0");
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);

        Assert.True(await ghosting.CheckAsync(match));

        await Db.Entry(silent).ReloadAsync();
        Assert.Equal(50, silent.TotalScore);
        Assert.Equal(0.9m, silent.ReputationScore);
        Assert.True(await Db.ScoreEvents.AnyAsync(e => e.UserId == silent.Id && e.EventType == "GhostPenalty" && e.Delta == 0));
    }

    [Fact]
    public async Task CheckAsync_StaleMatch_PenalizesOnlyWhoeverDidNotSendLastMessage()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        replier.TotalScore = 50;
        silent.TotalScore = 50;
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

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);
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

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);
        var result = await ghosting.CheckAsync(match);

        Assert.True(result);
        Assert.Equal("Ghosted", match.Status);

        await Db.Entry(userA).ReloadAsync();
        await Db.Entry(userB).ReloadAsync();

        Assert.Equal(0, userA.TotalScore);
        Assert.Equal(0, userB.TotalScore);
    }

    [Fact]
    public async Task CheckAsync_AtFaultUserWasProvenInsideTheWindow_DemotesThemImmediately()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        silent.Oath = "Bond";
        silent.OathSwornAt = DateTime.UtcNow.AddDays(-10);
        silent.OathProven = true;
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

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);
        await ghosting.CheckAsync(match);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == silent.Id);
        Assert.False(reloaded.OathProven);
    }

    [Fact]
    public async Task CheckAsync_SecondCheckOnSameStaleMatch_DoesNotPenalizeTwice()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        silent.TotalScore = 50;
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            MessageCount = 20,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);

        Assert.True(await ghosting.CheckAsync(match));

        var staleCopy = new Match
        {
            Id = match.Id,
            InitiatorId = match.InitiatorId,
            ReceiverId = match.ReceiverId,
            Status = "Active",
            MessageCount = match.MessageCount,
            LastMessageAt = match.LastMessageAt,
            LastMessageSenderId = match.LastMessageSenderId,
        };
        Assert.False(await ghosting.CheckAsync(staleCopy));

        await Db.Entry(silent).ReloadAsync();
        Assert.Equal(35, silent.TotalScore);
        Assert.Equal(0.9m, silent.ReputationScore);
        Assert.Equal(1, await Db.ScoreEvents.AsNoTracking()
            .CountAsync(e => e.UserId == silent.Id && e.EventType == "GhostPenalty"));
    }

    [Fact]
    public async Task CheckAsync_GhostingMatch_FreezesEarnedRevealLevel()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            RevealLevel = 1,
            MessageCount = 20,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config);

        Assert.True(await ghosting.CheckAsync(match));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Equal("Ghosted", reloaded.Status);
        Assert.Equal(3, reloaded.RevealLevel);
        Assert.Equal(3, RevealService.GetRevealLevel(new ConfigService(), reloaded));
    }
}
