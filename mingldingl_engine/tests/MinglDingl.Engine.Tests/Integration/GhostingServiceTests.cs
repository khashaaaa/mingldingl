using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class GhostingServiceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task CheckAsync_WhenAMatchGhosts_PushesMatchGhostedToBothParticipants()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        Db.Users.AddRange(replier, silent);
        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        var replierToken = await RegisterPushTokenAsync(replier.Id);
        var silentToken = await RegisterPushTokenAsync(silent.Id);

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var (push, handler) = BuildCapturingPush();
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, push);

        Assert.True(await ghosting.CheckAsync(match));

        var all = string.Join("\n", handler.RequestBodies);
        Assert.Equal(2, handler.RequestBodies.Count);
        Assert.Contains(replierToken, all);
        Assert.Contains(silentToken, all);
        Assert.Contains("\"type\":\"match_ghosted\"", all);
    }

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
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        // The pair really did talk: `silent` answered once and then stopped, which is what makes
        // them the ghost. Without the rows the match is a one-sided approach and carries no penalty.
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = silent.Id, Content = "hello" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "still there?" });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        config.Set("score.event.GhostPenalty", "0");
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

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
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        // The pair really did talk: `silent` answered once and then stopped, which is what makes
        // them the ghost. Without the rows the match is a one-sided approach and carries no penalty.
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = silent.Id, Content = "hello" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "still there?" });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
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
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
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
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        // The pair really did talk: `silent` answered once and then stopped, which is what makes
        // them the ghost. Without the rows the match is a one-sided approach and carries no penalty.
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = silent.Id, Content = "hello" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "still there?" });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
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
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            MessageCount = 20,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        // The pair really did talk: `silent` answered once and then stopped, which is what makes
        // them the ghost. Without the rows the match is a one-sided approach and carries no penalty.
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = silent.Id, Content = "hello" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "still there?" });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

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

    /// <summary>
    /// The monologue attack, closed at the other end. RevealService.MutualMessageCount stops one
    /// person talking their way into a stranger's profile while the match is Active — but the freeze
    /// read the raw total, so waiting out the ghosting window handed over exactly what the live gate
    /// refused: 30 messages into silence and the frozen level was the full reveal, at no cost, since
    /// someone who never spoke owes no ghost penalty either.
    /// </summary>
    [Fact]
    public async Task CheckAsync_GhostingAMonologue_FreezesAtTheFloorNotTheRawCount()
    {
        var talker = NewCompleteUser();
        var silent = NewCompleteUser();
        Db.Users.AddRange(talker, silent);

        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = talker.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            RevealLevel = 1,
            MessageCount = 30,
            InitiatorMessageCount = 30,
            ReceiverMessageCount = 0,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = talker.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

        Assert.True(await ghosting.CheckAsync(match));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Equal("Ghosted", reloaded.Status);
        Assert.Equal(1, reloaded.RevealLevel);
        Assert.Equal(1, RevealService.GetRevealLevel(new ConfigService(), reloaded));
    }

    [Fact]
    public async Task CheckAsync_GhostingMatch_FreezesEarnedRevealLevel()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            RevealLevel = 1,
            MessageCount = 20,
            // Both sides really spoke, so all 20 count toward the ladder.
            InitiatorMessageCount = 10,
            ReceiverMessageCount = 10,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

        Assert.True(await ghosting.CheckAsync(match));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Equal("Ghosted", reloaded.Status);
        Assert.Equal(3, reloaded.RevealLevel);
        Assert.Equal(3, RevealService.GetRevealLevel(new ConfigService(), reloaded));
    }

    /// <summary>
    /// Every match is created at reveal level 1, and ghosting must not take that back. Freezing on
    /// message count alone did: raise reveal.level1.messages above 1 — an admin-tunable knob — and a
    /// short conversation froze at 0, so being ghosted *hid* profile fields the pair already had.
    /// </summary>
    [Fact]
    public async Task CheckAsync_RevealThresholdTunedAboveTheFloor_FreezesAtTheFloorNotBelowIt()
    {
        var replier = NewCompleteUser();
        var silent = NewCompleteUser();
        Db.Users.AddRange(replier, silent);

        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = silent.Id,
            Status = "Active",
            RevealLevel = 1,
            MessageCount = 2,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        config.Set("reveal.level1.messages", "3");
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

        Assert.Equal(0, RevealService.LevelForMessageCount(config, match.MessageCount));
        Assert.True(await ghosting.CheckAsync(match));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Matches.AsNoTracking().SingleAsync(m => m.Id == match.Id);
        Assert.Equal("Ghosted", reloaded.Status);
        Assert.Equal(1, reloaded.RevealLevel);
        Assert.Equal(1, RevealService.GetRevealLevel(config, reloaded));
    }
    [Fact]
    public async Task CheckAsync_RecipientNeverSentAMessage_GhostsTheThreadButDoesNotPenaliseThem()
    {
        // A match is created without the target's consent, so silence from someone who never
        // engaged is not ghosting — it is disinterest. Penalising it let strangers drain a
        // victim's score by matching, sending one message and waiting.
        var approacher = NewCompleteUser();
        var recipient = NewCompleteUser();
        recipient.TotalScore = 100;
        recipient.ReputationScore = 1.0m;
        Db.Users.AddRange(approacher, recipient);
        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = approacher.Id,
            ReceiverId = recipient.Id,
            Status = "Active",
            MessageCount = 1,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = approacher.Id,
        };
        Db.Matches.Add(match);
        Db.Messages.Add(new Message
        {
            Id = Guid.NewGuid(), MatchId = match.Id, SenderId = approacher.Id, Content = "hey",
        });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

        Assert.True(await ghosting.CheckAsync(match));

        Assert.Equal("Ghosted", match.Status);
        var after = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == recipient.Id);
        Assert.Equal(100, after.TotalScore);
        Assert.Equal(1.0m, after.ReputationScore);
        Assert.False(await Db.ScoreEvents.AnyAsync(e => e.UserId == recipient.Id && e.EventType == "GhostPenalty"));
    }

    [Fact]
    public async Task CheckAsync_BothSpokeThenOneStopped_PenalisesTheOneWhoStopped()
    {
        var replier = NewCompleteUser();
        var abandoner = NewCompleteUser();
        abandoner.TotalScore = 100;
        Db.Users.AddRange(replier, abandoner);
        var match = new Match
        {
            Id = Guid.NewGuid(),
            InitiatorId = replier.Id,
            ReceiverId = abandoner.Id,
            Status = "Active",
            MessageCount = 3,
            LastMessageAt = DateTime.UtcNow.AddHours(-49),
            LastMessageSenderId = replier.Id,
        };
        Db.Matches.Add(match);
        Db.Messages.AddRange(
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "hi" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = abandoner.Id, Content = "hello" },
            new Message { Id = Guid.NewGuid(), MatchId = match.Id, SenderId = replier.Id, Content = "still there?" });
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());

        Assert.True(await ghosting.CheckAsync(match));

        Assert.True(await Db.ScoreEvents.AnyAsync(e => e.UserId == abandoner.Id && e.EventType == "GhostPenalty"));
    }

    [Fact]
    public async Task CheckAsync_UnansweredMatch_GhostsWithoutPenalisingAnyone()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match
        {
            InitiatorId = initiator.Id,
            ReceiverId = receiver.Id,
            Status = "Active",
            CreatedAt = DateTime.UtcNow.AddHours(-200),
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var ghosting = new GhostingService(Db, score, oaths, BuildTestBroadcast(), config, BuildTestPush());
        Assert.True(await ghosting.CheckAsync(match));

        Db.ChangeTracker.Clear();
        Assert.Equal("Ghosted", (await Db.Matches.FindAsync(match.Id))!.Status);
        // Nobody said anything, so nobody abandoned anything. Scoped to this match's two people:
        // the database is shared across the suite and other tests leave penalties of their own.
        Assert.Empty(Db.ScoreEvents
            .Where(e => e.EventType == "GhostPenalty"
                && (e.UserId == initiator.Id || e.UserId == receiver.Id))
            .ToList());
    }
}

public class GhostingServiceTests
{
    private static readonly Guid InitiatorId = Guid.NewGuid();
    private static readonly Guid ReceiverId = Guid.NewGuid();

    private static GhostingService CreateService(ConfigService? config = null) =>
        new(null!, null!, null!, null!, config ?? new ConfigService(), null!);

    [Fact]
    public void GetGhostAtFaultUserId_InitiatorSentLastMessage_BlamesReceiver()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = InitiatorId };
        Assert.Equal(ReceiverId, GhostingService.GetGhostAtFaultUserId(match));
    }

    [Fact]
    public void GetGhostAtFaultUserId_ReceiverSentLastMessage_BlamesInitiator()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = ReceiverId };
        Assert.Equal(InitiatorId, GhostingService.GetGhostAtFaultUserId(match));
    }

    [Fact]
    public void GetGhostAtFaultUserId_NoSenderRecorded_ReturnsNull()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = null };
        Assert.Null(GhostingService.GetGhostAtFaultUserId(match));
    }

    [Theory]
    [InlineData("Active", 49, true)]
    [InlineData("Active", 47, false)]
    [InlineData("Ghosted", 49, false)]
    public void IsStale_ChecksStatusAndThreshold(string status, int hoursSinceLastMessage, bool expected)
    {
        var match = new Match
        {
            Status = status,
            LastMessageAt = DateTime.UtcNow.AddHours(-hoursSinceLastMessage),
        };
        Assert.Equal(expected, CreateService().IsStale(match));
    }

    [Fact]
    public void IsStale_ThresholdOverriddenInConfig_UsesConfigHours()
    {
        var config = new ConfigService();
        config.Set("ghosting.stale_hours", "24");
        var service = CreateService(config);

        var match = new Match { Status = "Active", LastMessageAt = DateTime.UtcNow.AddHours(-25) };
        Assert.True(service.IsStale(match));
        Assert.Equal(TimeSpan.FromHours(24), service.StaleAfter);
    }

    [Fact]
    public void StaleAfter_ConfigBelowOneHour_ClampsToOneHour()
    {
        var config = new ConfigService();
        config.Set("ghosting.stale_hours", "0");
        Assert.Equal(TimeSpan.FromHours(1), CreateService(config).StaleAfter);
    }

    [Fact]
    public void IsStale_MatchNobodyEverSpokeIn_ClosesOnItsOwnLongerClock()
    {
        var config = new ConfigService();
        config.Set("ghosting.unanswered_hours", "168");
        var service = CreateService(config);

        var fresh = new Match { Status = "Active", CreatedAt = DateTime.UtcNow.AddHours(-1) };
        var abandoned = new Match { Status = "Active", CreatedAt = DateTime.UtcNow.AddHours(-200) };

        // Reading LastMessageAt alone left a summons nobody answered Active forever: the pair could
        // then never match again, since PairAlreadyMatchedAsync counts a row of any status.
        Assert.False(service.IsStale(fresh));
        Assert.True(service.IsStale(abandoned));
    }
}
