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
        var controller = new BusinessController(Db, BuildTestStorage())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    /// <summary>A date both participants confirmed at <paramref name="businessId"/> — what a rating reviews.</summary>
    private async Task SeedConfirmedDateAsync(Guid matchId, Guid businessId, bool bothConfirmed = true)
    {
        var suggestion = new ActivitySuggestion
        {
            Id = Guid.NewGuid(), MatchId = matchId, BusinessPartnerId = businessId, ActivityType = "Cafe", Title = "Cafe",
        };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = matchId,
            ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true,
            ReceiverConfirmed = bothConfirmed,
            CompletedAt = bothConfirmed ? DateTime.UtcNow : null,
        });
        await Db.SaveChangesAsync();
    }

    [Fact]
    public async Task Rate_NoConfirmedDateAtThisVenue_IsForbidden()
    {
        var initiatorId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, Guid.NewGuid());
        var business = await SeedBusinessAsync();
        var elsewhere = await SeedBusinessAsync();
        await SeedConfirmedDateAsync(match.Id, elsewhere.Id);
        await SeedConfirmedDateAsync(match.Id, business.Id, bothConfirmed: false);

        var result = await BuildController(initiatorId).Rate(business.Id, new RateBusinessRequest(1, null), match.Id);

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.False(await Db.BusinessRatings.AnyAsync(r => r.BusinessPartnerId == business.Id));
    }

    [Fact]
    public async Task Rate_PhotoNotUploadedByTheRater_IsRejected()
    {
        var initiatorId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();
        var match = await SeedMatchAsync(initiatorId, receiverId);
        var business = await SeedBusinessAsync();
        await SeedConfirmedDateAsync(match.Id, business.Id);

        var controller = BuildController(initiatorId);
        var foreign = await controller.Rate(business.Id,
            new RateBusinessRequest(5, null, "https://tracker.example.com/pixel.jpg"), match.Id);
        var someoneElses = await controller.Rate(business.Id,
            new RateBusinessRequest(5, null, $"/uploads/photos/{LocalFileStorageService.ProfilePhotoDirectory(receiverId)}a.jpg"), match.Id);

        Assert.IsType<BadRequestObjectResult>(foreign);
        Assert.IsType<BadRequestObjectResult>(someoneElses);

        var own = await controller.Rate(business.Id,
            new RateBusinessRequest(5, null, $"/uploads/photos/{LocalFileStorageService.ProfilePhotoDirectory(initiatorId)}a.jpg"), match.Id);
        Assert.IsType<OkObjectResult>(own);
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

    /// <summary>
    /// A venue with a Mongolian overlay set on all four fields, plus one left null so the fallback
    /// path is exercised too. The overlay values are placeholder ASCII, not real translations — this
    /// venue's actual Mongolian copy is owed to a native speaker (see BusinessPartner.NameMn).
    /// </summary>
    private async Task<BusinessPartner> SeedLocalisedBusinessAsync()
    {
        var business = new BusinessPartner
        {
            Name = "Sunset Point",
            NameMn = "mn-overlay-name",
            Category = "Outdoor",
            CategoryMn = "mn-overlay-category",
            City = "Ulaanbaatar",
            District = "Khan-Uul",
            DistrictMn = "mn-overlay-district",
            Description = "City viewpoint — best at sunset.",
            DescriptionMn = null,
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

    [Theory]
    [InlineData("en", "Sunset Point", "Outdoor", "Khan-Uul", "City viewpoint — best at sunset.")]
    [InlineData("mn", "mn-overlay-name", "mn-overlay-category", "mn-overlay-district", "City viewpoint — best at sunset.")]
    public async Task Get_ServesTheVenueInTheReadersOwnLanguage(
        string locale, string name, string category, string district, string description)
    {
        var reader = NewCompleteUser();
        reader.PreferredLocale = locale;
        Db.Users.Add(reader);
        var business = await SeedLocalisedBusinessAsync();

        var controller = BuildController(reader.Id);
        var result = await controller.Get(business.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<BusinessResponse>(ok.Value);

        Assert.Equal(name, body.Name);
        Assert.Equal(category, body.Category);
        Assert.Equal(district, body.District);
        // Description has no overlay seeded (DescriptionMn is null), so both locales fall back to
        // the same English string — this is the visible-gap behaviour the house rule prefers over a
        // guessed translation.
        Assert.Equal(description, body.Description);
    }

    [Fact]
    public async Task List_ServesTheVenueInTheReadersOwnLanguage()
    {
        var reader = NewCompleteUser();
        reader.PreferredLocale = LocalisedContent.MarketLocale;
        Db.Users.Add(reader);
        await SeedLocalisedBusinessAsync();

        var controller = BuildController(reader.Id);
        var result = await controller.List(city: null, category: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<PagedResponse<BusinessResponse>>(ok.Value);

        Assert.Contains(body.Items, b => b.Name == "mn-overlay-name" && b.Category == "mn-overlay-category");
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
        await SeedConfirmedDateAsync(match.Id, business.Id);

        var controller = BuildController(initiatorId);

        var first =await controller.Rate(business.Id, new RateBusinessRequest(4, null), match.Id);
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
        await SeedConfirmedDateAsync(matchC.Id, business.Id);

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
