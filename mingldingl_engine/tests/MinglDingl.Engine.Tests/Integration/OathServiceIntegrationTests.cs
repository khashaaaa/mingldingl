using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class OathServiceIntegrationTests : IntegrationTestBase
{
    private OathService BuildService(ConfigService? config = null)
    {
        var cfg = config ?? new ConfigService();
        var score = new ScoreService(Db, cfg);
        return new OathService(Db, cfg, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
    }

    private async Task<Guid> SeedCompletedEncountersAsync(Guid userId, int count, DateTime completedAt)
    {
        for (int i = 0; i < count; i++)
        {
            var partner = NewCompleteUser();
            Db.Users.Add(partner);
            var match = new Match { InitiatorId = userId, ReceiverId = partner.Id, Status = "Active" };
            Db.Matches.Add(match);
            var business = new BusinessPartner { Name = $"Test Cafe {i}", Category = "Cafe", City = "Ulaanbaatar" };
            Db.BusinessPartners.Add(business);
            await Db.SaveChangesAsync();

            var suggestion = new ActivitySuggestion
            {
                MatchId = match.Id, BusinessPartnerId = business.Id,
                ActivityType = "Cafe", Title = "Coffee",
            };
            Db.ActivitySuggestions.Add(suggestion);
            await Db.SaveChangesAsync();

            Db.DateConfirmations.Add(new DateConfirmation
            {
                MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
                InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = completedAt,
            });
            await Db.SaveChangesAsync();
        }
        return userId;
    }

    private async Task<User> SeedSwornUserAsync(DateTime swornAt)
    {
        var user = NewCompleteUser();
        user.Oath = "Bond";
        user.OathSwornAt = swornAt;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task Refresh_AtThreshold_BecomesProven()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow.AddDays(-1));

        bool transitioned = await BuildService().RefreshAsync(user.Id);

        Assert.True(transitioned);
        Assert.True((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);
    }

    [Fact]
    public async Task Refresh_OneEncounterShort_StaysSworn()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 1, DateTime.UtcNow.AddDays(-1));

        Assert.False(await BuildService().RefreshAsync(user.Id));
        Assert.False((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);
    }

    [Fact]
    public async Task Refresh_EncountersPredatingTheOath_DoNotCount()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-1));
        await SeedCompletedEncountersAsync(user.Id, 3, DateTime.UtcNow.AddDays(-30));

        Assert.False(await BuildService().RefreshAsync(user.Id));
    }

    [Fact]
    public async Task Refresh_GhostPenaltyInsideWindow_BlocksAndDemotes()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        user.OathProven = true;
        await SeedCompletedEncountersAsync(user.Id, 5, DateTime.UtcNow.AddDays(-2));
        Db.ScoreEvents.Add(new ScoreEvent
        {
            UserId = user.Id, EventType = "GhostPenalty", Delta = -15,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        });
        await Db.SaveChangesAsync();

        Assert.False(await BuildService().RefreshAsync(user.Id));
        Assert.False((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);
    }

    [Fact]
    public async Task Refresh_GhostPenaltyBeforeTheOath_DoesNotBlock()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-5));
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow.AddDays(-1));
        Db.ScoreEvents.Add(new ScoreEvent
        {
            UserId = user.Id, EventType = "GhostPenalty", Delta = -15,
            CreatedAt = DateTime.UtcNow.AddDays(-20),
        });
        await Db.SaveChangesAsync();

        Assert.True(await BuildService().RefreshAsync(user.Id));
    }

    [Fact]
    public async Task Refresh_ThresholdRaisedByConfig_IsRespected()
    {
        var config = new ConfigService();
        config.Set("oath.proven.encounters", "3");
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow.AddDays(-1));

        Assert.False(await BuildService(config).RefreshAsync(user.Id));
    }

    [Fact]
    public async Task Refresh_AlreadyProven_DoesNotPayTwice()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow.AddDays(-1));
        var service = BuildService();

        Assert.True(await service.RefreshAsync(user.Id));
        Assert.False(await service.RefreshAsync(user.Id));

        int payouts = await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "OathProven");
        Assert.Equal(1, payouts);
    }

    [Fact]
    public async Task Refresh_UnswornUser_IsANoOp()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        Assert.False(await BuildService().RefreshAsync(user.Id));
    }

    [Fact]
    public async Task Swear_ResetsWindowAndDropsProven()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        user.OathProven = true;
        await Db.SaveChangesAsync();

        var updated = await BuildService().SwearAsync(user.Id, "Fate");

        Assert.NotNull(updated);
        Assert.Equal("Fate", updated!.Oath);
        Assert.False(updated.OathProven);
        Assert.True(updated.OathSwornAt > DateTime.UtcNow.AddMinutes(-1));
    }

    /// <summary>
    /// Was <c>Swear_SameOathAgain_StillResetsTheWindow</c>, which asserted that re-swearing the oath
    /// you already hold cleared OathProven and restarted the clock. That is the behaviour this
    /// change reverses: nothing about the vow has changed, the app offers no reason to re-swear the
    /// same oath, and the reset silently destroyed progress on a misfired tap.
    /// </summary>
    [Fact]
    public async Task Swear_SameOathAgain_KeepsTheVowIntact()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        user.OathProven = true;
        await Db.SaveChangesAsync();

        var updated = await BuildService().SwearAsync(user.Id, "Bond");

        Assert.Equal("Bond", updated!.Oath);
        Assert.True(updated.OathProven);
    }

    [Fact]
    public async Task Swear_UnknownUser_ReturnsNull()
    {
        Assert.Null(await BuildService().SwearAsync(Guid.NewGuid(), "Bond"));
    }

    [Fact]
    public async Task Refresh_ReProvenAfterDemotion_DoesNotPayTwice()
    {
        var service = BuildService();
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow.AddDays(-5));

        Assert.True(await service.RefreshAsync(user.Id));

        Db.ScoreEvents.Add(new ScoreEvent
        {
            UserId = user.Id, EventType = "GhostPenalty", Delta = -15,
            CreatedAt = DateTime.UtcNow.AddDays(-3),
        });
        await Db.SaveChangesAsync();

        Assert.False(await service.RefreshAsync(user.Id));
        Assert.False((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);

        var reSworn = await service.SwearAsync(user.Id, "Fate");
        Assert.NotNull(reSworn);
        await SeedCompletedEncountersAsync(user.Id, 2, DateTime.UtcNow);

        Assert.True(await service.RefreshAsync(user.Id));
        Assert.True((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);

        int payouts = await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "OathProven");
        Assert.Equal(1, payouts);
    }

    [Fact]
    public async Task Refresh_TwoConfirmationsOnOneMatch_DoNotCountAsTwoEncounters()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));

        var partner = NewCompleteUser();
        Db.Users.Add(partner);
        var match = new Match { InitiatorId = user.Id, ReceiverId = partner.Id, Status = "Active" };
        Db.Matches.Add(match);
        var business = new BusinessPartner { Name = "Test Cafe", Category = "Cafe", City = "Ulaanbaatar" };
        Db.BusinessPartners.Add(business);
        await Db.SaveChangesAsync();

        for (int i = 0; i < 2; i++)
        {
            var suggestion = new ActivitySuggestion
            {
                MatchId = match.Id, BusinessPartnerId = business.Id,
                ActivityType = "Cafe", Title = $"Coffee {i}",
            };
            Db.ActivitySuggestions.Add(suggestion);
            await Db.SaveChangesAsync();

            Db.DateConfirmations.Add(new DateConfirmation
            {
                MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
                InitiatorConfirmed = true, ReceiverConfirmed = true,
                CompletedAt = DateTime.UtcNow.AddDays(-1),
            });
            await Db.SaveChangesAsync();
        }

        Assert.False(await BuildService().RefreshAsync(user.Id));
        Assert.False((await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).OathProven);
    }

    [Fact]
    public async Task GetProgress_UnswornUser_ReturnsNullHeldAndNeeded()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var (held, needed) = await BuildService().GetProgressAsync(user.Id);

        Assert.Null(held);
        Assert.Null(needed);
    }

    [Fact]
    public async Task GetProgress_CountsDistinctMatchesSinceTheSwear()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));
        await SeedCompletedEncountersAsync(user.Id, 1, DateTime.UtcNow.AddDays(-1));

        var (held, needed) = await BuildService().GetProgressAsync(user.Id);

        Assert.Equal(1, held);
        Assert.Equal(2, needed);
    }

    [Fact]
    public async Task GetProgress_EncountersPredatingTheSwear_DoNotCount()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-1));
        await SeedCompletedEncountersAsync(user.Id, 3, DateTime.UtcNow.AddDays(-30));

        var (held, _) = await BuildService().GetProgressAsync(user.Id);

        Assert.Equal(0, held);
    }

    [Fact]
    public async Task GetProgress_TwoConfirmationsOnOneMatch_CountAsOneEncounter()
    {
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));

        var partner = NewCompleteUser();
        Db.Users.Add(partner);
        var match = new Match { InitiatorId = user.Id, ReceiverId = partner.Id, Status = "Active" };
        Db.Matches.Add(match);
        var business = new BusinessPartner { Name = "Test Cafe", Category = "Cafe", City = "Ulaanbaatar" };
        Db.BusinessPartners.Add(business);
        await Db.SaveChangesAsync();

        for (int i = 0; i < 2; i++)
        {
            var suggestion = new ActivitySuggestion
            {
                MatchId = match.Id, BusinessPartnerId = business.Id,
                ActivityType = "Cafe", Title = $"Coffee {i}",
            };
            Db.ActivitySuggestions.Add(suggestion);
            await Db.SaveChangesAsync();

            Db.DateConfirmations.Add(new DateConfirmation
            {
                MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
                InitiatorConfirmed = true, ReceiverConfirmed = true,
                CompletedAt = DateTime.UtcNow.AddDays(-1),
            });
            await Db.SaveChangesAsync();
        }

        var (held, _) = await BuildService().GetProgressAsync(user.Id);

        Assert.Equal(1, held);
    }

    [Fact]
    public async Task GetProgress_ReflectsTheConfiguredThreshold()
    {
        var config = new ConfigService();
        config.Set("oath.proven.encounters", "3");
        var user = await SeedSwornUserAsync(DateTime.UtcNow.AddDays(-10));

        var (_, needed) = await BuildService(config).GetProgressAsync(user.Id);

        Assert.Equal(3, needed);
    }

    [Fact]
    public async Task SwearAsync_TheSameOathAgain_ChangesNothing()
    {
        // Re-swearing what you already swore is not a new vow. It used to reset OathSwornAt and
        // clear OathProven, so tapping your own oath a second time silently threw the progress away.
        var user = NewCompleteUser();
        user.Oath = "Bond";
        user.OathSwornAt = DateTime.UtcNow.AddDays(-10);
        user.OathProven = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        var sworn = user.OathSwornAt;

        var service = new OathService(Db, new ConfigService(), new ScoreService(Db, new ConfigService()),
            new MilestoneService(Db, NullLogger<MilestoneService>.Instance),
            new HonourService(Db, NullLogger<HonourService>.Instance));

        await service.SwearAsync(user.Id, "Bond");

        Db.ChangeTracker.Clear();
        var after = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.True(after.OathProven);
        Assert.True((after.OathSwornAt!.Value - sworn!.Value).Duration() < TimeSpan.FromSeconds(1),
            "the vow's clock must not restart");
    }

    [Fact]
    public async Task SwearAsync_ADifferentOath_RestartsTheVow()
    {
        var user = NewCompleteUser();
        user.Oath = "Bond";
        user.OathSwornAt = DateTime.UtcNow.AddDays(-10);
        user.OathProven = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var service = new OathService(Db, new ConfigService(), new ScoreService(Db, new ConfigService()),
            new MilestoneService(Db, NullLogger<MilestoneService>.Instance),
            new HonourService(Db, NullLogger<HonourService>.Instance));

        await service.SwearAsync(user.Id, "Fate");

        Db.ChangeTracker.Clear();
        var after = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal("Fate", after.Oath);
        Assert.False(after.OathProven);
    }
}
