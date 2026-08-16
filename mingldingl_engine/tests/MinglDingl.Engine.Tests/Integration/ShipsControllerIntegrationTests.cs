using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class ShipsControllerIntegrationTests : IntegrationTestBase
{
    private ShipsController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var milestones = new MilestoneService(Db);
        var push = new PushNotificationService(new HttpClient(), Db);
        var shipService = new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService(), milestones, push);
        var controller = new ShipsController(shipService, Db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private User AddUser(string phone)
    {
        var user = NewCompleteUser();
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
        var b = AddUser("88120003");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));

        var result = await BuildController(a.Id).GetPending();

        var response = Assert.IsType<List<PendingShipResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Single(response);
        Assert.Equal(weaver.DisplayName, response[0].WeaverDisplayName);
        // PendingShipResponse only ever has ShipId + WeaverDisplayName —
        // the type itself is the guarantee here; nothing about slot B
        // could leak even if this test forgot to check for it explicitly.
    }

    [Fact]
    public async Task Respond_BothAccept_SecondResponseReportsSparked()
    {
        var weaver = AddUser("88120001");
        var a = AddUser("88120002");
        var b = AddUser("88120003");
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
}
