using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class ShipsControllerIntegrationTests : IntegrationTestBase
{
    private ShipsController BuildController(Guid userId, ConfigService? config = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var push = BuildTestPush();
        var shipService = new ShipService(Db, new HonourService(Db, NullLogger<HonourService>.Instance), scoreService, new ConfigService(), milestones, push, BuildTestBroadcast(), NullLogger<ShipService>.Instance);
        var controller = new ShipsController(shipService, Db, config ?? new ConfigService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    // Gendered explicitly: a Fated Thread now resolves its nominees through MatchEligibility, and
    // every NewCompleteUser is Female, so a same-gender pair correctly refuses to spark.
    private User AddUser(string phone, string gender = "Female")
    {
        var user = NewCompleteUser(gender: gender);
        user.PhoneNumber = phone;
        Db.Users.Add(user);
        return user;
    }

    [Fact]
    public async Task Create_ValidPhones_ReturnsSuccess()
    {
        var weaver = AddUser("88120001");
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120002", "88120003"));

        var response = Assert.IsType<CreateShipResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.True(response.Success);
        Assert.NotNull(response.SlotACode);
        Assert.NotNull(response.SlotBCode);
    }

    [Fact]
    public async Task Create_ShipsDisabledInConfig_ReturnsNotFoundWithCodeAndWeavesNothing()
    {
        var weaver = AddUser("88120001");
        await Db.SaveChangesAsync();
        var config = new ConfigService();
        config.Set("ships.enabled", "false");
        var controller = BuildController(weaver.Id, config);

        var result = await controller.Create(new CreateShipRequest("88120002", "88120003"));

        var notFound = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("ship.disabled", Assert.IsType<ErrorResponse>(notFound.Value).Code);
        Assert.False(await Db.Ships.AnyAsync(s => s.ShipperUserId == weaver.Id));
    }

    [Fact]
    public async Task Create_SelfNomination_ReturnsBadRequest()
    {
        var weaver = AddUser("88120001");
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120001", "88120002"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetPending_ReturnsShipWeaverNameOnlyNoOtherSlotDetail()
    {
        var weaver = AddUser("88120001");
        var a = AddUser("88120002");
        var b = AddUser("88120003", "Male");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));

        var result = await BuildController(a.Id).GetPending();

        var response = Assert.IsType<List<PendingShipResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Single(response);
        Assert.Equal(weaver.DisplayName, response[0].WeaverDisplayName);
    }

    [Fact]
    public async Task Respond_BothAccept_SecondResponseReportsSparked()
    {
        var weaver = AddUser("88120001");
        var a = AddUser("88120002");
        var b = AddUser("88120003", "Male");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var first = await BuildController(a.Id).Respond(ship.Id, new RespondToShipRequest(true));
        var second = await BuildController(b.Id).Respond(ship.Id, new RespondToShipRequest(true));

        var firstBody = Assert.IsType<RespondToShipResponse>(Assert.IsType<OkObjectResult>(first).Value);
        var secondBody = Assert.IsType<RespondToShipResponse>(Assert.IsType<OkObjectResult>(second).Value);
        Assert.False(firstBody.Sparked);
        Assert.True(secondBody.Sparked);
    }

    [Fact]
    public async Task Create_NomineeAlreadyRegistered_MintsNoInviteCodeForThatSlot()
    {
        var weaver = AddUser("88120001");
        AddUser("88120002");
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120002", "88120003"));

        var response = Assert.IsType<CreateShipResponse>(Assert.IsType<OkObjectResult>(result).Value);
        // A registered nominee is invited in-app; a code handed to the Weaver for that slot is
        // never written to the ship and so could never resolve.
        Assert.Null(response.SlotACode);
        Assert.NotNull(response.SlotBCode);

        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.SingleAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Null(ship.SlotAInviteCode);
        Assert.Equal(response.SlotBCode, ship.SlotBInviteCode);
    }

    [Fact]
    public async Task Create_NomineeBlockedTheWeaver_ReturnsNoCodesBecauseNoShipWasWritten()
    {
        var weaver = AddUser("88120001");
        var blocker = AddUser("88120002");
        await Db.SaveChangesAsync();
        Db.BlockedUsers.Add(new BlockedUser { BlockerId = blocker.Id, BlockedId = weaver.Id });
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120002", "88120003"));

        var response = Assert.IsType<CreateShipResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.True(response.Success);
        Assert.Null(response.SlotACode);
        Assert.Null(response.SlotBCode);

        Db.ChangeTracker.Clear();
        Assert.Empty(await Db.Ships.Where(s => s.ShipperUserId == weaver.Id).ToListAsync());
    }

    [Fact]
    public async Task Respond_AcceptedTwiceConcurrently_SparksOnceAndPaysTheWeaverOnce()
    {
        var weaver = AddUser("88120001");
        var slotA = AddUser("88120002");
        var slotB = AddUser("88120003", "Male");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));

        Db.ChangeTracker.Clear();
        var shipId = (await Db.Ships.SingleAsync(s => s.ShipperUserId == weaver.Id)).Id;
        await BuildController(slotA.Id).Respond(shipId, new RespondToShipRequest(true));

        // A double-tapped accept on the second slot: both calls see both slots accepted.
        await BuildController(slotB.Id).Respond(shipId, new RespondToShipRequest(true));
        await BuildController(slotB.Id).Respond(shipId, new RespondToShipRequest(true));

        Db.ChangeTracker.Clear();
        Assert.Single(await Db.Matches.Where(m => m.ShipId == shipId).ToListAsync());
        Assert.Single(await Db.ScoreEvents
            .Where(e => e.UserId == weaver.Id && e.EventType == "ShipSparked").ToListAsync());
    }
}
