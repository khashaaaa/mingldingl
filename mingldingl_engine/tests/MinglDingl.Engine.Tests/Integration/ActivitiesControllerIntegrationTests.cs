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
        var activities = new ActivityService(Db, score, quests, milestones, broadcast, new ConfigService());
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

    [Fact]
    public async Task GetAttendanceCheck_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);

        var strangerId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(strangerId));
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);
        var result = Assert.IsType<ObjectResult>(await controller.GetAttendanceCheck(match.Id));
        Assert.Equal(403, result.StatusCode);
    }

    [Fact]
    public async Task GetAttendanceCheck_NotYetDue_ReturnsDueFalse()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-1),
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetAttendanceCheck(match.Id));
        var body = Assert.IsType<AttendanceCheckStatusResponse>(result.Value);
        Assert.False(body.Due);
    }

    [Fact]
    public async Task PostAttendanceCheck_ReturnsMyOwnRecordedAttendedValue()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(receiver.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.PostAttendanceCheck(match.Id, new AttendanceCheckRequestDto(false)));
        var body = Assert.IsType<AttendanceCheckResponse>(result.Value);
        Assert.False(body.Attended); // reflects the value just submitted, not "did they respond" (which would always be true)
    }

    [Fact]
    public async Task PostAttendanceCheck_NoEligibleConfirmation_ReturnsNotFound()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<NotFoundObjectResult>(await controller.PostAttendanceCheck(match.Id, new AttendanceCheckRequestDto(true)));
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task GetMyTrophies_MismatchedAttendance_MarksEntryAsMismatchedWithoutExposingEitherAnswer()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
            InitiatorAttended = true, ReceiverAttended = false,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTrophies());
        var body = Assert.IsType<List<TrophyResponse>>(result.Value);

        var entry = Assert.Single(body);
        Assert.True(entry.Mismatched);
    }

    [Fact]
    public async Task GetMyTrophies_BothConfirmedAttendance_NotMismatched()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
            InitiatorAttended = true, ReceiverAttended = true,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTrophies());
        var body = Assert.IsType<List<TrophyResponse>>(result.Value);

        var entry = Assert.Single(body);
        Assert.False(entry.Mismatched);
    }
}
