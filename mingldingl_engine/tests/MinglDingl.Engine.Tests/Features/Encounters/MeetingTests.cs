using FluentAssertions;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Encounters;

public class MeetingTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task A_meeting_needs_the_third_seal_and_while_required_the_rite()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        var venue = (await (await w.F.AdminAsync()).AddVenueAsync()).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 10);
        (await CodeOf(await bat.C.ProposeRawAsync(bond, venue, w.F.Clock.UtcNow.AddDays(1)))).Should().Be("meeting.seal");
        await ExchangeAsync(bond, bat.C, saruul.C, 5);
        (await CodeOf(await bat.C.ProposeRawAsync(bond, venue, w.F.Clock.UtcNow.AddDays(1)))).Should().Be("meeting.rite");
        var e = await bat.C.EncounterAsync(bond);
        e.Meeting!.Open.Should().BeFalse();
        e.Meeting.Blocked.Should().Be("rite");
    }

    [Fact]
    public async Task Both_pledges_swear_the_meeting_once_with_points_for_each()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        (await CodeOf(await m.Bat.C.ProposeRawAsync(m.Bond, m.Venue, m.W.F.Clock.UtcNow.AddMinutes(30)))).Should().Be("meeting.time");
        (await CodeOf(await m.Bat.C.ProposeRawAsync(m.Bond, m.Venue, m.W.F.Clock.UtcNow.AddDays(31)))).Should().Be("meeting.time");

        var proposed = await m.Bat.C.ProposeAsync(m.Bond, m.Venue, m.Tomorrow);
        proposed.MyPledge.Should().BeTrue();
        proposed.TheirPledge.Should().BeFalse();
        var hers = (await m.Saruul.C.EncounterAsync(m.Bond)).Meeting!.Current!;
        (hers.ProposedByMe, hers.TheirPledge, hers.State).Should().Be((false, true, "Proposed"));

        var batBefore = await m.Bat.C.PointsAsync();
        var sworn = await (await m.Saruul.C.MeetingActRawAsync(m.Bond, proposed.Id, "pledge"))
            .Read<EncounterView>();
        sworn.Meeting!.Current!.State.Should().Be("Sworn");
        (await m.Bat.C.PointsAsync()).Should().Be(batBefore + 50);
        (await CodeOf(await m.Saruul.C.MeetingActRawAsync(m.Bond, proposed.Id, "pledge"))).Should().Be("meeting.not_open");
        (await CodeOf(await m.Bat.C.ProposeRawAsync(m.Bond, m.Venue, m.Tomorrow))).Should().Be("meeting.sworn");
    }

    [Fact]
    public async Task Suggesting_another_time_replaces_the_proposal_and_its_pledge()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var first = await m.Bat.C.ProposeAsync(m.Bond, m.Venue, m.Tomorrow);
        var counter = await m.Saruul.C.ProposeAsync(m.Bond, m.Venue, m.Tomorrow.AddHours(3));
        counter.Id.Should().NotBe(first.Id);
        var his = (await m.Bat.C.EncounterAsync(m.Bond)).Meeting!.Current!;
        (his.Id, his.MyPledge, his.TheirPledge).Should().Be((counter.Id, false, true));
        (await CodeOf(await m.Bat.C.MeetingActRawAsync(m.Bond, first.Id, "pledge"))).Should().Be("meeting.not_open");
    }

    [Fact]
    public async Task A_sworn_meeting_may_be_called_off_until_it_starts()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var id = await m.SwornAsync();
        (await m.Bat.C.MeetingActRawAsync(m.Bond, id, "call-off")).EnsureSuccessStatusCode();
        var e = await m.Saruul.C.EncounterAsync(m.Bond);
        e.Meeting!.Current.Should().BeNull();
        e.Next.Should().Be("meeting", "they may choose again");

        var again = await m.SwornAsync();
        await m.W.AdvanceAsync(TimeSpan.FromDays(1) + TimeSpan.FromMinutes(1));
        (await CodeOf(await m.Bat.C.MeetingActRawAsync(m.Bond, again, "call-off"))).Should().Be("meeting.started");
    }

    [Fact]
    public async Task A_place_removed_after_the_proposal_cannot_be_pledged_to()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var p = await m.Bat.C.ProposeAsync(m.Bond, m.Venue, m.Tomorrow);
        (await m.Admin.DeleteAsync($"/admin/venues/{m.Venue}")).EnsureSuccessStatusCode();
        (await m.Saruul.C.EncounterAsync(m.Bond)).Meeting!.Current!.Venue.Gone.Should().BeTrue();
        (await CodeOf(await m.Saruul.C.MeetingActRawAsync(m.Bond, p.Id, "pledge"))).Should().Be("meeting.venue_gone");
    }
}
