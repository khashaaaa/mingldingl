using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class OathRewardIntegrationTests : IntegrationTestBase
{
    [Fact]
    public void Catalog_ContainsTheOathkeeperTitle()
    {
        var item = LootService.Catalog.SingleOrDefault(c => c.Id == "title_oathkeeper");
        Assert.NotNull(item);
        Assert.Equal("Title", item!.ItemType);
        Assert.Equal("Rare", item.Rarity);
        Assert.Equal("item_title_oathkeeper", item.NameKey);
    }

    [Fact]
    public void Milestones_ContainOathProven()
    {
        var def = MilestoneService.Defs.SingleOrDefault(d => d.Id == "oath_proven");
        Assert.NotNull(def);
        Assert.Equal("milestone_oath_proven", def!.NameKey);
        Assert.Equal(40, def.Xp);
    }

    [Fact]
    public async Task ProvingAnOath_GrantsScoreMilestoneAndTitle()
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new LootService(Db, score, NullLogger<LootService>.Instance));

        var user = NewCompleteUser();
        user.Oath = "Bond";
        user.OathSwornAt = DateTime.UtcNow.AddDays(-5);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        for (int i = 0; i < 2; i++)
        {
            var partner = NewCompleteUser();
            Db.Users.Add(partner);
            var match = new Match { InitiatorId = user.Id, ReceiverId = partner.Id, Status = "Active" };
            Db.Matches.Add(match);
            var business = new BusinessPartner { Name = $"Cafe {i}", Category = "Cafe", City = "Ulaanbaatar" };
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
                InitiatorConfirmed = true, ReceiverConfirmed = true,
                CompletedAt = DateTime.UtcNow.AddHours(-1),
            });
            await Db.SaveChangesAsync();
        }

        Assert.True(await oaths.RefreshAsync(user.Id));

        Assert.Equal(1, await Db.ScoreEvents.CountAsync(e => e.UserId == user.Id && e.EventType == "OathProven"));
        Assert.True(await Db.UserMilestones.AnyAsync(m => m.UserId == user.Id && m.MilestoneId == "oath_proven"));
        Assert.True(await Db.UserItems.AnyAsync(i => i.UserId == user.Id && i.ItemId == "title_oathkeeper"));
    }
}
