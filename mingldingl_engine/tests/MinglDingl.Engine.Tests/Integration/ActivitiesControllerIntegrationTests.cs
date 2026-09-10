using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class ActivitiesControllerIntegrationTests : IntegrationTestBase
{
    private ActivitiesController BuildController(Guid userId, ConfigService? configOverride = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var config = configOverride ?? new ConfigService();
        var score = new ScoreService(Db, config);
        var quests = new QuestService(Db, score, config, NullLogger<QuestService>.Instance);
        var milestones = new MilestoneService(Db, NullLogger<MilestoneService>.Instance);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object, NullLogger<SupabaseBroadcastService>.Instance);
        var oaths = new OathService(Db, config, score, milestones, new HonourService(Db, NullLogger<HonourService>.Instance));
        var activities = new ActivityService(Db, score, quests, milestones, broadcast, config, oaths, BuildTestPush(), new HonourService(Db, NullLogger<HonourService>.Instance));
        var controller = new ActivitiesController(Db, activities, config)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task GetSuggestions_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match
        {
            InitiatorId = initiator.Id,
            ReceiverId = receiver.Id,
            Status = "Active",
            MessageCount = 20,
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
    public async Task GetSuggestions_BelowTheConfiguredMessageThreshold_IsLocked()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active", MessageCount = 15 };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        config.Set("activity.suggestions.messages", "20");
        var result = Assert.IsType<BadRequestObjectResult>(await BuildController(initiator.Id, config).GetSuggestions(match.Id));

        Assert.Equal("activity.locked", Assert.IsType<ErrorResponse>(result.Value).Code);
    }

    [Fact]
    public async Task GetSuggestions_ThresholdTunedBelowDefault_UnlocksAtTheTunedCount()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        // Per-side counts, because the gate reads the mutual count: three messages one person sent
        // into silence must not carry them to the pledge flow alone.
        var match = new Match
        {
            InitiatorId = initiator.Id, ReceiverId = receiver.Id, Status = "Active",
            MessageCount = 3, InitiatorMessageCount = 2, ReceiverMessageCount = 1,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var config = new ConfigService();
        config.Set("activity.suggestions.messages", "3");
        var result = await BuildController(initiator.Id, config).GetSuggestions(match.Id);

        Assert.IsType<OkObjectResult>(result);
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
        Assert.False(body.Attended);
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

    [Fact]
    public async Task ConfirmDate_RiteRequiredAndIncomplete_ReturnsForbiddenWithRiteCopy()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match
        {
            InitiatorId = initiator.Id, ReceiverId = receiver.Id,
            MessageCount = 20, IcebreakerComplete = true,
        };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<ObjectResult>(await controller.ConfirmDate(match.Id, new ConfirmDateDto(suggestion.Id)));

        Assert.Equal(403, result.StatusCode);
        Assert.Equal("Complete the Flame Rite before pledging an encounter", ErrorMessage(result));
    }

    [Fact]
    public async Task ConfirmDate_SuggestionNotInMatch_ReturnsNotFoundWithSuggestionCopy()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match
        {
            InitiatorId = initiator.Id, ReceiverId = receiver.Id,
            MessageCount = 20, IcebreakerComplete = true,
            FlameRiteCompletedAt = DateTime.UtcNow,
        };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<NotFoundObjectResult>(await controller.ConfirmDate(match.Id, new ConfirmDateDto(Guid.NewGuid())));

        Assert.Equal(404, result.StatusCode);
        Assert.Equal("Activity suggestion not found for this match", ErrorMessage(result));
    }

    private static string? ErrorMessage(ObjectResult result) =>
        (result.Value as ErrorResponse)?.Error;
}
