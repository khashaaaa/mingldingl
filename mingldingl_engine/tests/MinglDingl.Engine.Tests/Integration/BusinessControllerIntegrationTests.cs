using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class BusinessControllerIntegrationTests : IntegrationTestBase
{
    private BusinessController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var controller = new BusinessController(Db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private async Task<BusinessPartner> SeedBusinessAsync()
    {
        var business = new BusinessPartner
        {
            Name = "Test Cafe",
            Category = "Cafe",
            City = "Ulaanbaatar",
            District = "Sukhbaatar",
            IsVerified = true,
        };
        Db.BusinessPartners.Add(business);
        await Db.SaveChangesAsync();
        return business;
    }

    private async Task<Match> SeedMatchAsync(Guid initiatorId, Guid receiverId)
    {
        var initiator = NewCompleteUser(initiatorId);
        var receiver = NewCompleteUser(receiverId);
        Db.Users.AddRange(initiator, receiver);

        var match = new Match { InitiatorId = initiatorId, ReceiverId = receiverId, Status = "Active" };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();
        return match;
    }

    [Fact]
    public async Task Rate_MatchNotFound_ReturnsNotFound()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        var business = await SeedBusinessAsync();
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Rate(business.Id, new RateBusinessRequest(5, null), Guid.NewGuid());

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Rate_CallerNotParticipantInMatch_ReturnsForbidden()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);
        var business = await SeedBusinessAsync();

        var outsiderId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(outsiderId));
        await Db.SaveChangesAsync();

        var controller = BuildController(outsiderId);
        var result = await controller.Rate(business.Id, new RateBusinessRequest(5, null), match.Id);

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);

        var reloadedBusiness = await Db.BusinessPartners.AsNoTracking().FirstAsync(b => b.Id == business.Id);
        Assert.Equal(0, reloadedBusiness.RatingCount);
    }

    [Fact]
    public async Task Rate_SameUserSameMatchTwice_SecondCallReturnsConflict()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);
        var business = await SeedBusinessAsync();

        var controller = BuildController(initiatorId);

        var first = await controller.Rate(business.Id, new RateBusinessRequest(4, null), match.Id);
        Assert.IsType<OkObjectResult>(first);

        var second = await controller.Rate(business.Id, new RateBusinessRequest(2, null), match.Id);
        Assert.IsType<ConflictObjectResult>(second);

        var ratingCount = await Db.BusinessRatings.CountAsync(r => r.BusinessPartnerId == business.Id);
        Assert.Equal(1, ratingCount);

        var reloadedBusiness = await Db.BusinessPartners.AsNoTracking().FirstAsync(b => b.Id == business.Id);
        Assert.Equal(1, reloadedBusiness.RatingCount);
    }

    [Fact]
    public async Task Rate_RecomputesAverageAndCountAtomicallyFromSourceOfTruth()
    {
        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();
        var userCId = Guid.NewGuid();
        var matchA = await SeedMatchAsync(userAId, Guid.NewGuid());
        var matchB = await SeedMatchAsync(userBId, Guid.NewGuid());
        var matchC = await SeedMatchAsync(userCId, Guid.NewGuid());

        var business = await SeedBusinessAsync();

        business.RatingCount = 0;
        business.AverageRating = 0;

        Db.BusinessRatings.AddRange(
            new BusinessRating { BusinessPartnerId = business.Id, UserId = userAId, MatchId = matchA.Id, Stars = 5 },
            new BusinessRating { BusinessPartnerId = business.Id, UserId = userBId, MatchId = matchB.Id, Stars = 3 });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();

        var controller = BuildController(userCId);
        var result = await controller.Rate(business.Id, new RateBusinessRequest(4, null), matchC.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<RateBusinessResponse>(ok.Value);

        Assert.Equal(3, body.RatingCount);
        Assert.Equal(4.0m, body.AverageRating);

        var reloadedBusiness = await Db.BusinessPartners.AsNoTracking().FirstAsync(b => b.Id == business.Id);
        Assert.Equal(3, reloadedBusiness.RatingCount);
        Assert.Equal(4.0m, reloadedBusiness.AverageRating);
    }
}
