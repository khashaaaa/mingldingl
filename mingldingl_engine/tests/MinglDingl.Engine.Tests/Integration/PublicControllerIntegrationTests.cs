using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class PublicControllerIntegrationTests : IntegrationTestBase
{
    private PublicController BuildController() => new(Db);

    private async Task<PublicStatsResponse> GetStatsBody() =>
        Assert.IsType<PublicStatsResponse>(Assert.IsType<OkObjectResult>(await BuildController().GetStats()).Value);

    [Fact]
    public async Task GetStats_ActiveDaters_CountsDistinctUsersNotRawEventCount()
    {
        var before = await GetStatsBody();

        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DailyLogin", Delta = 5, CreatedAt = DateTime.UtcNow.AddDays(-1) });
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DailyLogin", Delta = 5, CreatedAt = DateTime.UtcNow.AddDays(-2) });
        await Db.SaveChangesAsync();

        var after = await GetStatsBody();
        Assert.Equal(before.ActiveDatersThisWeek + 1, after.ActiveDatersThisWeek);
    }

    [Fact]
    public async Task GetStats_ExcludesActivityOlderThanSevenDays()
    {
        var before = await GetStatsBody();

        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DailyLogin", Delta = 5, CreatedAt = DateTime.UtcNow.AddDays(-10) });
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "DateConfirmed", Delta = 50, CreatedAt = DateTime.UtcNow.AddDays(-10) });

        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        Db.Matches.Add(new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active", CreatedAt = DateTime.UtcNow.AddDays(-10) });
        await Db.SaveChangesAsync();

        var after = await GetStatsBody();
        Assert.Equal(before.ActiveDatersThisWeek, after.ActiveDatersThisWeek);
        Assert.Equal(before.NewBondsThisWeek, after.NewBondsThisWeek);
        Assert.Equal(before.DatesConfirmedThisWeek, after.DatesConfirmedThisWeek);
    }

    [Fact]
    public async Task GetStats_NewBonds_CountsMatchesCreatedThisWeek()
    {
        var before = await GetStatsBody();

        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", CreatedAt = DateTime.UtcNow.AddDays(-1) });
        await Db.SaveChangesAsync();

        var after = await GetStatsBody();
        Assert.Equal(before.NewBondsThisWeek + 1, after.NewBondsThisWeek);
    }

    [Fact]
    public async Task GetStats_DatesConfirmed_HalvesRawEventCountSinceBothParticipantsAreAwarded()
    {
        var before = await GetStatsBody();

        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = initiator.Id, EventType = "DateConfirmed", Delta = 50, CreatedAt = DateTime.UtcNow.AddHours(-1) });
        Db.ScoreEvents.Add(new ScoreEvent { UserId = receiver.Id, EventType = "DateConfirmed", Delta = 50, CreatedAt = DateTime.UtcNow.AddHours(-1) });
        await Db.SaveChangesAsync();

        var after = await GetStatsBody();
        Assert.Equal(before.DatesConfirmedThisWeek + 1, after.DatesConfirmedThisWeek);
    }

    [Fact]
    public void GetStatsPage_ReturnsHtmlContentType()
    {
        var result = BuildController().GetStatsPage();
        Assert.Equal("text/html", result.ContentType);
        Assert.Contains("This Week in the Realm", result.Content);
    }

    [Fact]
    public async Task GetShipInvite_PendingCodeInEitherSlot_ReturnsValid()
    {
        var shipper = NewCompleteUser();
        Db.Users.Add(shipper);
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Pending", SlotAInviteCode = "ABC123" });
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Pending", SlotBInviteCode = "XYZ789" });
        await Db.SaveChangesAsync();

        var controller = BuildController();
        var slotA = Assert.IsType<OkObjectResult>(await controller.GetShipInvite("ABC123"));
        var slotB = Assert.IsType<OkObjectResult>(await controller.GetShipInvite("XYZ789"));

        Assert.True(Assert.IsType<PublicShipInviteResponse>(slotA.Value).Valid);
        Assert.True(Assert.IsType<PublicShipInviteResponse>(slotB.Value).Valid);
    }

    [Fact]
    public async Task GetShipInvite_CodeIsCaseInsensitive()
    {
        var shipper = NewCompleteUser();
        Db.Users.Add(shipper);
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Pending", SlotAInviteCode = "ABC123" });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().GetShipInvite("abc123"));
        Assert.True(Assert.IsType<PublicShipInviteResponse>(result.Value).Valid);
    }

    [Fact]
    public async Task GetShipInvite_AlreadySparkedShip_ReturnsInvalid()
    {
        var shipper = NewCompleteUser();
        Db.Users.Add(shipper);
        Db.Ships.Add(new Ship { ShipperUserId = shipper.Id, Status = "Sparked", SlotAInviteCode = "ABC123" });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().GetShipInvite("ABC123"));
        Assert.False(Assert.IsType<PublicShipInviteResponse>(result.Value).Valid);
    }

    [Fact]
    public async Task GetShipInvite_UnknownCode_ReturnsInvalid()
    {
        var result = Assert.IsType<OkObjectResult>(await BuildController().GetShipInvite("NOPE00"));
        Assert.False(Assert.IsType<PublicShipInviteResponse>(result.Value).Valid);
    }

    [Fact]
    public async Task GetShipInvite_MissingCode_ReturnsInvalidWithoutQuerying()
    {
        var resultNull = Assert.IsType<OkObjectResult>(await BuildController().GetShipInvite(null));
        var resultEmpty = Assert.IsType<OkObjectResult>(await BuildController().GetShipInvite("   "));

        Assert.False(Assert.IsType<PublicShipInviteResponse>(resultNull.Value).Valid);
        Assert.False(Assert.IsType<PublicShipInviteResponse>(resultEmpty.Value).Valid);
    }

    [Fact]
    public void GetShipInvitePage_ReturnsHtmlContentType()
    {
        var result = BuildController().GetShipInvitePage();
        Assert.Equal("text/html", result.ContentType);
        Assert.Contains("A Thread Has Been Woven", result.Content);
    }
}
