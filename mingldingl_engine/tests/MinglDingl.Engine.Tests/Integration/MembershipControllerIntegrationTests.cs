using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class MembershipControllerIntegrationTests : IntegrationTestBase
{
    /// <summary>
    /// Purchases are shut by default — nothing charges anyone yet — so every test that exercises
    /// buying has to open the switch the way an operator would. <paramref name="config"/> is for
    /// the tests that care what happens while it is shut.
    /// </summary>
    private static ConfigService OpenForSale()
    {
        var config = new ConfigService();
        config.Set("membership.purchase.enabled", "true");
        return config;
    }

    private MembershipController BuildController(Guid userId, ConfigService? config = null)
    {
        config ??= OpenForSale();
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        return new MembershipController(Db, new MembershipCatalog(config), config)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    [Fact]
    public async Task Upgrade_ToPaidTier_WhilePurchasesAreClosed_IsRefused()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId, new ConfigService());

        var result = await controller.Upgrade(new UpgradeMembershipDto("Gold", 1));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Free", (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == userId)).MembershipLevel);
    }

    [Fact]
    public async Task Upgrade_ToFree_IsAllowedWhilePurchasesAreClosed()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddMonths(1);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var controller = BuildController(userId, new ConfigService());

        // Cancelling is not buying, so the sale switch must not be able to trap someone on a tier.
        Assert.IsType<OkObjectResult>(await controller.Upgrade(new UpgradeMembershipDto("Free", 0)));
        Assert.Equal("Free", (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == userId)).MembershipLevel);
    }

    [Fact]
    public async Task Upgrade_RenewingTheSameTierEarly_AddsToTheRemainingTermRatherThanResettingIt()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddMonths(2);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        await controller.Upgrade(new UpgradeMembershipDto("Gold", 1));

        // Roughly three months out, not one: renewing early used to throw away what was left.
        var expiresAt = (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == userId)).MembershipExpiresAt;
        Assert.NotNull(expiresAt);
        Assert.True(expiresAt > DateTime.UtcNow.AddMonths(2), $"expected the old term to be extended, got {expiresAt}");
    }

    [Fact]
    public void GetTiers_ExposesExactlyFreeSilverAndGold()
    {
        var controller = BuildController(Guid.NewGuid());
        var result = Assert.IsType<OkObjectResult>(controller.GetTiers());
        var tiers = Assert.IsType<List<MembershipTierResponse>>(result.Value);

        Assert.Equal(new[] { "Free", "Silver", "Gold" }, tiers.Select(t => t.Level));
    }

    [Fact]
    public async Task Upgrade_ToRetiredPlatinumTier_ReturnsBadRequest()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var controller = BuildController(userId);

        var result = await controller.Upgrade(new UpgradeMembershipDto("Platinum", 1));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Free", (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == userId)).MembershipLevel);
    }

    [Fact]
    public void GetTiers_FreeTier_HasNoPriceOptions()
    {
        var controller = BuildController(Guid.NewGuid());
        var result = Assert.IsType<OkObjectResult>(controller.GetTiers());
        var tiers = Assert.IsType<List<MembershipTierResponse>>(result.Value);

        var free = tiers.Single(t => t.Level == "Free");
        Assert.Empty(free.Prices);
    }

    [Fact]
    public void GetTiers_SilverTier_HasAllThreeDurationsWithCorrectDiscounts()
    {
        var controller = BuildController(Guid.NewGuid());
        var result = Assert.IsType<OkObjectResult>(controller.GetTiers());
        var tiers = Assert.IsType<List<MembershipTierResponse>>(result.Value);

        var silver = tiers.Single(t => t.Level == "Silver");
        Assert.Equal(new[] { 1, 3, 6 }, silver.Prices.Select(p => p.DurationMonths).OrderBy(m => m));
        Assert.Equal(10900, silver.Prices.Single(p => p.DurationMonths == 1).TotalPriceMnt);
        Assert.Equal(29430, silver.Prices.Single(p => p.DurationMonths == 3).TotalPriceMnt);
        Assert.Equal(52320, silver.Prices.Single(p => p.DurationMonths == 6).TotalPriceMnt);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(6)]
    public async Task Upgrade_ToPaidTier_SetsExpiryAndLogsAPurchase(int durationMonths)
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var before = DateTime.UtcNow;
        var controller = BuildController(userId);
        var result = Assert.IsType<OkObjectResult>(await controller.Upgrade(new UpgradeMembershipDto("Silver", durationMonths)));
        var body = Assert.IsType<MembershipMeResponse>(result.Value);

        Assert.Equal("Silver", body.MembershipLevel);
        Assert.NotNull(body.ExpiresAt);
        var expectedExpiry = before.AddMonths(durationMonths);
        Assert.True(Math.Abs((body.ExpiresAt!.Value - expectedExpiry).TotalSeconds) < 5,
            $"expected ExpiresAt near {expectedExpiry:o}, got {body.ExpiresAt:o}");

        var purchase = await Db.Memberships.SingleAsync(m => m.UserId == userId);
        Assert.Equal("Silver", purchase.Level);
        Assert.Equal(durationMonths, purchase.DurationMonths);
        var silverMonthly = new MembershipCatalog(new ConfigService()).Find("Silver")!.MonthlyPriceMnt!.Value;
        Assert.Equal(MembershipPricing.PriceOptions(silverMonthly).Single(p => p.DurationMonths == durationMonths).TotalPriceMnt, purchase.PriceMnt);
    }

    [Fact]
    public async Task Upgrade_InvalidDuration_ReturnsBadRequestAndWritesNoPurchase()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Upgrade(new UpgradeMembershipDto("Silver", 2));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await Db.Memberships.AnyAsync(m => m.UserId == userId));
    }

    [Fact]
    public async Task Upgrade_LowercaseLevel_TreatedCaseInsensitivelyNotAsUnknownTier()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Upgrade(new UpgradeMembershipDto("gold", 1));

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<MembershipMeResponse>(ok.Value);
        Assert.Equal("Gold", body.MembershipLevel);
    }

    [Fact]
    public async Task Upgrade_ToFree_ClearsExpiryAndLogsAZeroValuePurchase()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddMonths(3);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = Assert.IsType<OkObjectResult>(await controller.Upgrade(new UpgradeMembershipDto("Free", 0)));
        var body = Assert.IsType<MembershipMeResponse>(result.Value);

        Assert.Equal("Free", body.MembershipLevel);
        Assert.Null(body.ExpiresAt);

        var purchase = await Db.Memberships.SingleAsync(m => m.UserId == userId);
        Assert.Equal("Free", purchase.Level);
        Assert.Equal(0, purchase.DurationMonths);
        Assert.Equal(0, purchase.PriceMnt);
        Assert.Null(purchase.ExpiresAt);
    }

    [Fact]
    public async Task Upgrade_Renewal_AddsToTheRemainingTermRatherThanResettingIt()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Silver";
        var standingExpiry = DateTime.UtcNow.AddMonths(5);
        user.MembershipExpiresAt = standingExpiry;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = Assert.IsType<OkObjectResult>(await controller.Upgrade(new UpgradeMembershipDto("Silver", 1)));
        var body = Assert.IsType<MembershipMeResponse>(result.Value);

        // Six months out, not one: resetting the clock made renewing early a way to lose the five
        // months you had already paid for.
        var expectedExpiry = standingExpiry.AddMonths(1);
        Assert.True(Math.Abs((body.ExpiresAt!.Value - expectedExpiry).TotalSeconds) < 5,
            $"expected ExpiresAt near {expectedExpiry:o} (extended), got {body.ExpiresAt:o}");
    }

    [Fact]
    public async Task Upgrade_ChangingTier_StartsTheNewTermFromNow()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Silver";
        user.MembershipExpiresAt = DateTime.UtcNow.AddMonths(5);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var before = DateTime.UtcNow;
        var result = Assert.IsType<OkObjectResult>(
            await BuildController(userId).Upgrade(new UpgradeMembershipDto("Gold", 1)));
        var body = Assert.IsType<MembershipMeResponse>(result.Value);

        // Time bought on one tier is not time on another, so a switch does not carry it across.
        var expectedExpiry = before.AddMonths(1);
        Assert.True(Math.Abs((body.ExpiresAt!.Value - expectedExpiry).TotalSeconds) < 5,
            $"expected ExpiresAt near {expectedExpiry:o}, got {body.ExpiresAt:o}");
    }

    [Fact]
    public async Task GetMine_ReturnsCurrentLevelAndExpiry()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.MembershipLevel = "Gold";
        user.MembershipExpiresAt = DateTime.UtcNow.AddMonths(6);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMine());
        var body = Assert.IsType<MembershipMeResponse>(result.Value);

        Assert.Equal("Gold", body.MembershipLevel);

        Assert.True(Math.Abs((body.ExpiresAt!.Value - user.MembershipExpiresAt!.Value).Ticks) < 10,
            $"expected {user.MembershipExpiresAt:o}, got {body.ExpiresAt:o}");
    }
}
