using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class PublicControllerIntegrationTests : IntegrationTestBase
{
    private PublicController BuildController() => new(Db);

    // GetStats counts across the whole Users/Matches/ScoreEvents tables
    // (unauthenticated aggregate stats, not scoped to a caller) against the
    // shared dev Postgres this suite runs on — which already has real
    // pre-existing activity inside any 7-day window, unlike every other
    // integration test here that scopes its own assertions to specific
    // seeded ids. These assert the count moved by exactly the expected
    // delta after seeding, not an absolute value.
    private async Task<PublicStatsResponse> GetStatsBody() =>
        Assert.IsType<PublicStatsResponse>(Assert.IsType<OkObjectResult>(await BuildController().GetStats()).Value);

    [Fact]
    public async Task GetStats_ActiveDaters_CountsDistinctUsersNotRawEventCount()
    {
        // A user who logs in on multiple days this week awards multiple
        // DailyLogin ScoreEvents (see ScoreService) — the stat is "how many
        // people were active," not "how many login events fired," so two
        // events from the same user must still count as one dater.
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
        // ActivityService.AwardManyAsync awards DateConfirmed to both the
        // initiator and receiver for the same real-world confirmed date, so
        // two ScoreEvent rows here represent exactly one confirmed date.
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
        // Same code namespace, but ShipService.RespondAsync clears the
        // spent slot's InviteCode to null and flips Status once both slots
        // accept — a Sparked/Declined/Expired ship's code must never read
        // as still-valid on this preview page.
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
