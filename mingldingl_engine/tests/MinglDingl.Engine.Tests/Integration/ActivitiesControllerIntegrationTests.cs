using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace MinglDingl.Engine.Tests.Integration;

public class ActivitiesControllerIntegrationTests : IntegrationTestBase
{
    private ActivitiesController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var milestones = new MilestoneService(Db);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object);
        var activities = new ActivityService(Db, score, quests, milestones, broadcast);
        var controller = new ActivitiesController(Db, activities)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task GetSuggestions_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        // Security regression: GetSuggestions loaded the match but never checked
        // IsParticipant, unlike ConfirmDate in the same controller — any
        // authenticated user who knew a matchId could read that match's private
        // date-activity suggestions.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match
        {
            InitiatorId = initiator.Id,
            ReceiverId = receiver.Id,
            Status = "Active",
            MessageCount = 20, // above the 15-message unlock threshold
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var strangerId = Guid.NewGuid();
        var stranger = NewCompleteUser(strangerId);
        Db.Users.Add(stranger);
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);

        var result = Assert.IsType<ObjectResult>(await controller.GetSuggestions(match.Id));
        Assert.Equal(403, result.StatusCode);
    }
}
