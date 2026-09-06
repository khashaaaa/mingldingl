using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class CampaignControllerIntegrationTests : IntegrationTestBase
{
    private CampaignController BuildController(Guid userId, ConfigService? config = null)
    {
        config ??= new ConfigService();
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, config);
        var loot = new HonourService(Db, NullLogger<HonourService>.Instance);
        return new CampaignController(Db, new CampaignService(Db, score, loot, config))
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
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
    public async Task GetCampaign_Participant_ReturnsRoomState()
    {
        var (match, initiator, _) = await NewMatchAsync();

        var result = await BuildController(initiator.Id).GetCampaign(match.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<CampaignResponse>(ok.Value);
        Assert.Equal(CampaignService.RoomOrder.Count, body.Rooms.Count);
    }

    [Fact]
    public async Task GetCampaign_NonParticipant_Returns403()
    {
        var (match, _, _) = await NewMatchAsync();
        var stranger = NewCompleteUser();
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var result = await BuildController(stranger.Id).GetCampaign(match.Id);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, status.StatusCode);
    }

    [Fact]
    public async Task GetCampaign_CampaignDisabled_Returns404()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var config = new ConfigService();
        config.Set("campaign.enabled", "false");

        var result = await BuildController(initiator.Id, config).GetCampaign(match.Id);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ClaimRoom_CampaignDisabled_Returns404AndPaysNothing()
    {
        var (match, initiator, _) = await NewMatchAsync();
        var config = new ConfigService();
        config.Set("campaign.enabled", "false");

        var result = await BuildController(initiator.Id, config).ClaimRoom(match.Id, "gate");

        Assert.IsType<NotFoundObjectResult>(result);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.CampaignRoomClaims.Where(c => c.MatchId == match.Id));
    }

    [Fact]
    public async Task ClaimRoom_Participant_ReturnsAward()
    {
        var (match, initiator, _) = await NewMatchAsync();

        var result = await BuildController(initiator.Id).ClaimRoom(match.Id, "gate");

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<ClaimCampaignRoomResponse>(ok.Value);
        Assert.Equal(5, body.Awarded);
    }

    [Fact]
    public async Task ClaimRoom_GhostedMatch_StillWorksForClearedRoom()
    {
        var (match, initiator, _) = await NewMatchAsync();
        match.Status = "Ghosted";
        await Db.SaveChangesAsync();

        var result = await BuildController(initiator.Id).ClaimRoom(match.Id, "gate");

        Assert.IsType<OkObjectResult>(result);
    }
}
