using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class CampaignServiceIntegrationTests : IntegrationTestBase
{
    private CampaignService BuildService(ConfigService? config = null)
    {
        config ??= new ConfigService();
        var score = new ScoreService(Db, config);
        var loot = new LootService(Db, score, NullLogger<LootService>.Instance);
        return new CampaignService(Db, score, loot, config);
    }

    private async Task<(Match Match, User Initiator, User Receiver)> NewMatchAsync()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return (match, initiator, receiver);
    }

    [Fact]
    public async Task GetState_NewMatch_OnlyGateClearedInRoomOrder()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var service = BuildService();

        var state = await service.GetStateAsync(match, initiator.Id);

        Assert.Equal(CampaignService.RoomOrder, state.Rooms.Select(r => r.RoomId));
        Assert.True(state.Rooms.Single(r => r.RoomId == "gate").Cleared);
        Assert.All(state.Rooms.Where(r => r.RoomId != "gate"), r => Assert.False(r.Cleared));
        Assert.Equal(1, state.ClearedCount);
        Assert.False(state.BossCleared);
    }

    [Fact]
    public async Task GetState_FullyProgressedMatch_AllRoomsClearedAndBossCleared()
    {
        var (match, initiator, receiver) = await NewMatchAsync();
        match.IcebreakerComplete = true;
        match.MessageCount = 15;
        match.VideoRewardClaimed = true;

        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Campaign Quiz" });
        Db.QuizResponses.Add(new QuizResponse { QuizId = quizId, UserId = initiator.Id, MatchId = match.Id, Answers = [] });
        Db.QuizResponses.Add(new QuizResponse { QuizId = quizId, UserId = receiver.Id, MatchId = match.Id, Answers = [] });

        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id,
            ActivitySuggestionId = Guid.NewGuid(),
            InitiatorConfirmed = true,
            ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow,
            InitiatorAttended = true,
            ReceiverAttended = true,
        });
        await Db.SaveChangesAsync();

        var state = await BuildService().GetStateAsync(match, initiator.Id);

        Assert.All(state.Rooms, r => Assert.True(r.Cleared, $"room {r.RoomId} should be cleared"));
        Assert.Equal(CampaignService.RoomOrder.Count, state.ClearedCount);
        Assert.True(state.BossCleared);
    }

    [Fact]
    public async Task GetState_QuizAnsweredByOnlyOneUser_RunesNotCleared()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var quizId = Guid.NewGuid();
        Db.Quizzes.Add(new Quiz { Id = quizId, Title = "Half Quiz" });
        Db.QuizResponses.Add(new QuizResponse { QuizId = quizId, UserId = initiator.Id, MatchId = match.Id, Answers = [] });
        await Db.SaveChangesAsync();

        var state = await BuildService().GetStateAsync(match, initiator.Id);

        Assert.False(state.Rooms.Single(r => r.RoomId == "runes").Cleared);
    }

    [Fact]
    public async Task GetState_PledgeCompleteButUnattended_BridgeClearedBossNot()
    {
        var (match, initiator, _) = await NewMatchAsync();
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id,
            ActivitySuggestionId = Guid.NewGuid(),
            InitiatorConfirmed = true,
            ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();

        var state = await BuildService().GetStateAsync(match, initiator.Id);

        Assert.True(state.Rooms.Single(r => r.RoomId == "bridge").Cleared);
        Assert.False(state.Rooms.Single(r => r.RoomId == "threshold").Cleared);
        Assert.False(state.BossCleared);
    }

    [Fact]
    public async Task Claim_ClearedRoom_PaysBonusOnceAndSecondClaimConflicts()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var service = BuildService();

        var result = await service.ClaimAsync(match, initiator.Id, "gate");
        Assert.Equal(5, result.Awarded);

        var second = await Assert.ThrowsAsync<DomainException>(
            () => service.ClaimAsync(match, initiator.Id, "gate"));
        Assert.Equal(StatusCodes.Status409Conflict, second.StatusCode);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.CampaignRoomClaims.Where(c => c.MatchId == match.Id && c.UserId == initiator.Id));
        var events = Db.ScoreEvents.Where(e => e.UserId == initiator.Id && e.EventType == "CampaignRoomBonus").ToList();
        Assert.Single(events);
        Assert.Equal(5, events[0].Delta);
        var user = await Db.Users.FindAsync(initiator.Id);
        Assert.Equal(5, user!.TotalScore);
    }

    [Fact]
    public async Task Claim_EachPartnerClaimsIndependently()
    {
        var (match, initiator, receiver) = await NewMatchAsync();
        var service = BuildService();

        await service.ClaimAsync(match, initiator.Id, "gate");
        var receiverResult = await service.ClaimAsync(match, receiver.Id, "gate");

        Assert.Equal(5, receiverResult.Awarded);
        Db.ChangeTracker.Clear();
        Assert.Equal(2, Db.CampaignRoomClaims.Count(c => c.MatchId == match.Id && c.RoomId == "gate"));
    }

    [Fact]
    public async Task Claim_UnclearedRoom_ConflictsAndPaysNothing()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var service = BuildService();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => service.ClaimAsync(match, initiator.Id, "echoes"));
        Assert.Equal(StatusCodes.Status409Conflict, ex.StatusCode);

        Db.ChangeTracker.Clear();
        Assert.Empty(Db.CampaignRoomClaims.Where(c => c.MatchId == match.Id));
        Assert.Empty(Db.ScoreEvents.Where(e => e.UserId == initiator.Id));
    }

    [Fact]
    public async Task Claim_UnknownRoom_NotFound()
    {
        var (match, initiator, _) = await NewMatchAsync();

        var ex = await Assert.ThrowsAsync<DomainException>(
            () => BuildService().ClaimAsync(match, initiator.Id, "throne"));
        Assert.Equal(StatusCodes.Status404NotFound, ex.StatusCode);
    }

    [Fact]
    public async Task Claim_BossRoom_PaysBossBonusAndGrantsGuaranteedLoot()
    {
        var (match, initiator, _) = await NewMatchAsync();
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id,
            ActivitySuggestionId = Guid.NewGuid(),
            InitiatorConfirmed = true,
            ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow,
            InitiatorAttended = true,
            ReceiverAttended = true,
        });
        await Db.SaveChangesAsync();

        var result = await BuildService().ClaimAsync(match, initiator.Id, "threshold");

        Assert.Equal(25, result.Awarded);
        Assert.NotNull(result.DroppedItem);
        Db.ChangeTracker.Clear();
        var events = Db.ScoreEvents.Where(e => e.UserId == initiator.Id && e.EventType == "CampaignBossBonus").ToList();
        Assert.Single(events);
        Assert.Equal(25, events[0].Delta);
        Assert.Single(Db.UserItems.Where(i => i.UserId == initiator.Id && i.Source == "campaign"));
    }

    [Fact]
    public async Task Claim_BonusAmountsComeFromConfig()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var config = new ConfigService();
        config.Set("campaign.room.bonus", "12");

        var result = await BuildService(config).ClaimAsync(match, initiator.Id, "gate");

        Assert.Equal(12, result.Awarded);
    }

    [Fact]
    public async Task GetState_ReflectsCallersClaimsOnly()
    {
        var (match, initiator, receiver) = await NewMatchAsync();
        var service = BuildService();
        await service.ClaimAsync(match, initiator.Id, "gate");

        var mine = await service.GetStateAsync(match, initiator.Id);
        var theirs = await service.GetStateAsync(match, receiver.Id);

        Assert.True(mine.Rooms.Single(r => r.RoomId == "gate").Claimed);
        Assert.False(theirs.Rooms.Single(r => r.RoomId == "gate").Claimed);
    }
}
