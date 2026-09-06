using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class OathEndpointIntegrationTests : IntegrationTestBase
{
    private UsersController BuildController(Guid userId)
    {
        var config = new ConfigService();
        var score = new ScoreService(Db, config);
        var oaths = new OathService(Db, config, score, new MilestoneService(Db, NullLogger<MilestoneService>.Instance), new HonourService(Db, NullLogger<HonourService>.Instance));
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        return NewUsersController(Db, oaths, httpContext);
    }

    [Theory]
    [InlineData("Bond")]
    [InlineData("Fate")]
    [InlineData("Kinship")]
    public async Task SwearOath_ValidValue_PersistsAsSworn(string oath)
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(
            await BuildController(user.Id).SwearOath(new SwearOathRequest(oath)));
        var body = Assert.IsType<UserResponse>(result.Value);

        Assert.Equal(oath, body.Oath);
        Assert.False(body.OathProven);

        var stored = await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal(oath, stored.Oath);
        Assert.NotNull(stored.OathSwornAt);
    }

    [Theory]
    [InlineData("bond")]
    [InlineData("Casual")]
    [InlineData("")]
    public async Task SwearOath_InvalidValue_ReturnsBadRequestAndChangesNothing(string oath)
    {
        var user = NewCompleteUser();
        user.Oath = "Bond";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = await BuildController(user.Id).SwearOath(new SwearOathRequest(oath));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Bond", (await Db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).Oath);
    }

    [Fact]
    public async Task SwearOath_UnknownUser_ReturnsNotFound()
    {
        var result = await BuildController(Guid.NewGuid()).SwearOath(new SwearOathRequest("Bond"));
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public void SwearOath_CannotSetProvenFromTheClient()
    {
        var names = typeof(SwearOathRequest).GetProperties().Select(p => p.Name).ToArray();
        Assert.Equal(new[] { "Oath" }, names);
    }

    [Fact]
    public async Task SwearOath_Response_CarriesFreshProgress()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(
            await BuildController(user.Id).SwearOath(new SwearOathRequest("Bond")));
        var body = Assert.IsType<UserResponse>(result.Value);

        Assert.Equal(0, body.OathEncountersHeld);
        Assert.Equal(2, body.OathEncountersNeeded);
    }
}
