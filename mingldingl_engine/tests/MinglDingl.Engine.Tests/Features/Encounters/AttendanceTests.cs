using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Encounters;

public class AttendanceTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Theory]
    [InlineData("Met", "Met", "Kept")]
    [InlineData("NoShow", "Met", "Disputed")]
    [InlineData("NoShow", "NoShow", "Disputed")]
    [InlineData("NoShow", "CouldNotGo", "Excused")]
    [InlineData("CouldNotGo", "Met", "Excused")]
    public async Task Both_answers_settle_the_meeting_at_once(string his, string hers, string outcome)
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.AskedAsync();
        var asked = await m.Bat.C.EncounterAsync(m.Bond);
        asked.Next.Should().Be("attendance");
        asked.Meeting!.Current!.State.Should().Be("Checking");

        (await m.Bat.C.AttendRawAsync(m.Bond, id, his)).EnsureSuccessStatusCode();
        (await CodeOf(await m.Bat.C.AttendRawAsync(m.Bond, id, his))).Should().Be("attendance.answered");
        (await m.Saruul.C.EncounterAsync(m.Bond)).Meeting!.Current!.MyAnswer.Should().BeNull("his answer is private");
        var before = await m.Saruul.C.MeAsync();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, hers)).EnsureSuccessStatusCode();

        await using var scope = m.W.F.Services.CreateAsyncScope();
        var row = await Read(m, id);
        row.Outcome.ToString().Should().Be(outcome);
        row.NoShowOf.Should().BeNull("no one is blamed when both answered");
        (await m.Saruul.C.MeAsync()).Profile!.Points.Should().Be(before.Profile!.Points, "settling pays no points");
    }

    [Fact]
    public async Task They_did_not_come_against_silence_is_a_no_show_and_the_third_costs_reputation()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        for (var n = 1; n <= 3; n++)
        {
            var id = await m.AskedAsync();
            (await m.Bat.C.AttendRawAsync(m.Bond, id, "NoShow")).EnsureSuccessStatusCode();
            await m.W.AdvanceAsync(TimeSpan.FromHours(49));
            await m.W.SweepAsync();
            var row = await Read(m, id);
            (row.Outcome, row.NoShowOf).Should().Be((MeetingOutcome.NoShow, m.Saruul.Id));
            var reputation = await Reputation(m, m.Saruul.Id);
            reputation.Should().Be(n < 3 ? 100 : 90, $"no-show {n} of 3");
        }
    }

    [Fact]
    public async Task One_met_and_silence_is_not_kept_and_blames_no_one()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.AskedAsync();
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        await m.W.AdvanceAsync(TimeSpan.FromHours(49));
        await m.W.SweepAsync();
        var row = await Read(m, id);
        (row.Outcome, row.NoShowOf).Should().Be((MeetingOutcome.Unanswered, (Guid?)null));
    }

    [Fact]
    public async Task A_kept_meeting_may_be_rated_once_and_two_prove_the_oath()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var first = await m.AskedAsync();
        (await CodeOf(await m.Bat.C.RateRawAsync(m.Bond, first, 5))).Should().Be("venue.not_kept");
        (await m.Bat.C.AttendRawAsync(m.Bond, first, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, first, "Met")).EnsureSuccessStatusCode();
        var kept = await m.Bat.C.EncounterAsync(m.Bond);
        kept.Next.Should().Be("rate");
        kept.Meeting!.Current!.CanRate.Should().BeTrue();
        (await m.Bat.C.RateRawAsync(m.Bond, first, 4)).EnsureSuccessStatusCode();
        (await CodeOf(await m.Bat.C.RateRawAsync(m.Bond, first, 5))).Should().Be("venue.rated");
        (await m.Saruul.C.RateRawAsync(m.Bond, first, 0)).EnsureSuccessStatusCode(); // skipped
        (await m.Saruul.C.EncounterAsync(m.Bond)).Meeting!.Current.Should().BeNull("a skipped rating is asked no more");
        var venue = (await m.Bat.C.GetFromJsonAsync<VenueView>($"/venues/{m.Venue}"))!;
        (venue.Rating, venue.Ratings).Should().Be((4.0, 1), "a skip counts nowhere");
        (await m.Bat.C.MeAsync()).Profile!.OathProvenAt.Should().BeNull("one kept meeting is not yet proof");

        var second = await m.AskedAsync();
        var before = await m.Bat.C.PointsAsync();
        (await m.Bat.C.AttendRawAsync(m.Bond, second, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, second, "Met")).EnsureSuccessStatusCode();
        (await m.Bat.C.MeAsync()).Profile!.OathProvenAt.Should().NotBeNull();
        (await m.Bat.C.PointsAsync()).Should().Be(before + 40);
    }

    [Fact]
    public async Task A_sworn_meeting_holds_the_fire_until_it_is_settled()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.AskedAsync(); // 28 hours of silence, then the question
        await m.W.AdvanceAsync(TimeSpan.FromHours(30));
        await m.W.SweepAsync();
        (await m.Bat.C.BondAsync(m.Bond)).State.Should().Be("Live", "the pair met instead of writing");
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        await m.W.AdvanceAsync(TimeSpan.FromHours(47));
        await m.W.SweepAsync();
        (await m.Bat.C.BondAsync(m.Bond)).State.Should().Be("Live", "the silence counts again from the settling");
        await m.W.AdvanceAsync(TimeSpan.FromHours(2));
        await m.W.SweepAsync();
        (await m.Bat.C.BondAsync(m.Bond)).State.Should().Be("Cold");
    }

    [Fact]
    public async Task A_proposal_no_one_pledged_to_lapses_when_its_time_passes()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var p = await m.Bat.C.ProposeAsync(m.Bond, m.Venue, m.Tomorrow);
        await m.W.AdvanceAsync(TimeSpan.FromDays(1) + TimeSpan.FromMinutes(5));
        await m.W.SweepAsync();
        (await Read(m, p.Id)).State.Should().Be(MeetingState.CalledOff);
    }

    private static async Task<Meeting> Read(MeetingWorld m, Guid id)
    {
        await using var scope = m.W.F.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        return await db.Set<Meeting>().AsNoTracking().SingleAsync(x => x.Id == id);
    }

    private static async Task<int> Reputation(MeetingWorld m, Guid id)
    {
        await using var scope = m.W.F.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        return await db.Set<MinglDingl.Engine.Features.Profile.Profile>().Where(p => p.AccountId == id).Select(p => p.Reputation).SingleAsync();
    }
}
