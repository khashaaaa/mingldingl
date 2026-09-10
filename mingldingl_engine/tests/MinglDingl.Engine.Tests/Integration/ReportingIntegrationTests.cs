using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>
/// User-to-user reporting. The score economy carried a <c>ReportPenalty</c> delta long before
/// anything could award it: there was no way to report anyone and no queue to act on, so blocking
/// a person you were already matched with was the only lever anyone had.
/// </summary>
public class ReportingIntegrationTests : IntegrationTestBase
{
    private ReportService Reports() =>
        new(Db, new ScoreService(Db, new ConfigService()), BuildTestBroadcast());

    private async Task<(User Reporter, User Reported)> TwoUsersAsync()
    {
        var reporter = NewCompleteUser(gender: "Male");
        var reported = NewCompleteUser();
        Db.Users.AddRange(reporter, reported);
        await Db.SaveChangesAsync();
        return (reporter, reported);
    }

    [Fact]
    public async Task Reporting_FilesTheReport_BlocksThemAndEndsTheConversation()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var match = MatchPairing.NewMatch(reporter.Id, reported.Id);
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var report = await Reports().CreateAsync(
            reporter.Id, reported.Id, ReportReasons.Harassment, "  kept messaging after I asked  ", match.Id);

        Assert.Equal(ReportOutcomes.Pending, report.Status);
        Assert.Equal("kept messaging after I asked", report.Details);
        Assert.Equal(match.Id, report.MatchId);

        // Reporting means wanting them gone. Leaving the thread live let the reported person keep
        // messaging while the queue was worked.
        Assert.True(await Db.BlockedUsers.AnyAsync(b => b.BlockerId == reporter.Id && b.BlockedId == reported.Id));
        Assert.Equal("Unmatched", (await Db.Matches.FindAsync(match.Id))!.Status);
    }

    [Fact]
    public async Task AMatchTheReporterIsNotIn_IsNotRecordedOnTheReport()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var strangers = (NewCompleteUser(gender: "Male"), NewCompleteUser());
        Db.Users.AddRange(strangers.Item1, strangers.Item2);
        await Db.SaveChangesAsync();
        var someoneElsesMatch = MatchPairing.NewMatch(strangers.Item1.Id, strangers.Item2.Id);
        Db.Matches.Add(someoneElsesMatch);
        await Db.SaveChangesAsync();

        var report = await Reports().CreateAsync(
            reporter.Id, reported.Id, ReportReasons.Scam, null, someoneElsesMatch.Id);

        // Otherwise the moderator opens the report and reads a conversation neither party is in.
        Assert.Null(report.MatchId);
    }

    [Fact]
    public async Task ASecondOpenReportAboutTheSamePerson_IsRefused()
    {
        var (reporter, reported) = await TwoUsersAsync();
        await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.FakeProfile, null, null);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.FakeProfile, null, null));
        Assert.Equal("report.already_open", ex.Code);
        Assert.Equal(StatusCodes.Status409Conflict, ex.StatusCode);
    }

    [Fact]
    public async Task OnceResolved_TheSameReporterMayReportAgain()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var first = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Harassment, null, null);
        await Reports().ResolveAsync(first.Id, ReportOutcomes.Dismissed, "no evidence", "admin");

        var second = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Harassment, null, null);
        Assert.Equal(ReportOutcomes.Pending, second.Status);
    }

    [Theory]
    [InlineData("NotAReason")]
    [InlineData("")]
    public async Task AnUnknownReason_IsRefused(string reason)
    {
        var (reporter, reported) = await TwoUsersAsync();
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            Reports().CreateAsync(reporter.Id, reported.Id, reason, null, null));
        Assert.Equal("report.reason_invalid", ex.Code);
    }

    [Fact]
    public async Task ReportingYourself_IsRefused()
    {
        var (reporter, _) = await TwoUsersAsync();
        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            Reports().CreateAsync(reporter.Id, reporter.Id, ReportReasons.Other, null, null));
        Assert.Equal("report.self", ex.Code);
    }

    /// <summary>
    /// The delta is admin-applied on purpose. Awarding it the moment someone is reported would let
    /// any two accounts drive anyone's score down on demand.
    /// </summary>
    [Fact]
    public async Task Penalised_IsTheOnlyThingThatSpendsTheReportPenalty()
    {
        var (reporter, reported) = await TwoUsersAsync();
        // Scores floor at zero, so a fresh account cannot show a penalty at all.
        reported.TotalScore = 500;
        await Db.SaveChangesAsync();
        int before = reported.TotalScore;
        var report = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Harassment, null, null);

        Assert.Equal(before, (await Db.Users.FindAsync(reported.Id))!.TotalScore);

        await Reports().ResolveAsync(report.Id, ReportOutcomes.Penalised, "upheld", "admin");

        Db.ChangeTracker.Clear();
        var after = await Db.Users.FindAsync(reported.Id);
        Assert.Equal(before + new ScoreService(Db, new ConfigService()).Delta("ReportPenalty"), after!.TotalScore);
        Assert.True(await Db.ScoreEvents.AnyAsync(e => e.UserId == reported.Id && e.EventType == "ReportPenalty"));
    }

    [Fact]
    public async Task Banned_SuspendsTheAccountAndEndsItsLiveMatches()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var thirdParty = NewCompleteUser(gender: "Male");
        Db.Users.Add(thirdParty);
        await Db.SaveChangesAsync();
        var unrelatedMatch = MatchPairing.NewMatch(thirdParty.Id, reported.Id);
        Db.Matches.Add(unrelatedMatch);
        await Db.SaveChangesAsync();

        var report = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Underage, null, null);
        await Reports().ResolveAsync(report.Id, ReportOutcomes.Banned, "verified", "admin");

        Db.ChangeTracker.Clear();
        var banned = await Db.Users.FindAsync(reported.Id);
        Assert.True(banned!.IsBanned);
        // Their partner would otherwise sit in a thread that can never be answered, taking ghosting
        // state for a person who has been thrown out.
        Assert.Equal("Unmatched", (await Db.Matches.FindAsync(unrelatedMatch.Id))!.Status);
    }

    [Fact]
    public async Task ResolvingTwice_IsRefused()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var report = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Other, null, null);
        await Reports().ResolveAsync(report.Id, ReportOutcomes.Warned, null, "admin");

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            Reports().ResolveAsync(report.Id, ReportOutcomes.Banned, null, "admin"));
        Assert.Equal("report.already_resolved", ex.Code);
    }

    [Fact]
    public async Task AnUnknownOutcome_IsRefused()
    {
        var (reporter, reported) = await TwoUsersAsync();
        var report = await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Other, null, null);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            Reports().ResolveAsync(report.Id, ReportOutcomes.Pending, null, "admin"));
        Assert.Equal("report.outcome_invalid", ex.Code);
    }

    [Fact]
    public async Task TheAdminQueue_ShowsOpenReportsAndTheirCount()
    {
        var (reporter, reported) = await TwoUsersAsync();
        await Reports().CreateAsync(reporter.Id, reported.Id, ReportReasons.Harassment, "details", null);

        var controller = new AdminReportsController(Db, Reports(), new AdminAuditService(Db));
        var listed = Assert.IsType<OkObjectResult>(await controller.ListReports());
        var page = Assert.IsType<PagedResponse<AdminReportListItemDto>>(listed.Value);
        var row = Assert.Single(page.Items, r => r.ReportedUserId == reported.Id);
        Assert.Equal(ReportReasons.Harassment, row.Reason);
        Assert.Equal(ReportOutcomes.Pending, row.Status);

        var counted = Assert.IsType<OkObjectResult>(await controller.PendingCount());
        Assert.True(Assert.IsType<PendingReportCountDto>(counted.Value).Pending >= 1);
    }
}
