using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminShipsControllerIntegrationTests : IntegrationTestBase
{
    private AdminShipsController BuildController() => new(Db);

    [Fact]
    public async Task ListShips_ReturnsShipperAndSlotDisplayNames()
    {
        var shipper = NewCompleteUser();
        shipper.DisplayName = "Shipper Bat";
        var slotA = NewCompleteUser();
        slotA.DisplayName = "Slot A Sarnai";
        Db.Users.AddRange(shipper, slotA);

        Db.Ships.Add(new Ship
        {
            ShipperUserId = shipper.Id,
            Status = "Pending",
            SlotAUserId = slotA.Id,
            SlotAOptIn = "Accepted",
            SlotBOptIn = "AwaitingUser",
        });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().ListShips(null, 1, 20));
        var page = Assert.IsType<PagedResponse<AdminShipListItemDto>>(result.Value);

        var item = Assert.Single(page.Items);
        Assert.Equal("Shipper Bat", item.ShipperDisplayName);
        Assert.Equal("Slot A Sarnai", item.SlotADisplayName);
        Assert.Null(item.SlotBDisplayName);
    }

    [Fact]
    public async Task ListShips_FiltersByStatus()
    {
        var shipper = NewCompleteUser();
        Db.Users.Add(shipper);
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Sparked" });
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Pending" });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().ListShips("Sparked", 1, 20));
        var page = Assert.IsType<PagedResponse<AdminShipListItemDto>>(result.Value);

        Assert.Single(page.Items);
        Assert.Equal("Sparked", page.Items[0].Status);
    }
}
