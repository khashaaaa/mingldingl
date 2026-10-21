using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Campaign;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Hall;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Road;

public class BondRoadTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Chambers_clear_as_the_pair_plays_and_each_pays_both_once()
    {
        await using var w = await World.CreateAsync(db, campaign: true);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        (await Campaign(bat.C, bond)).Cleared.Should().Be(0);

        await bat.C.WriteAsync(bond, "Hello");
        await saruul.C.WriteAsync(bond, "Hi");
        var c = await Campaign(saruul.C, bond);
        c.Chambers.Where(x => x.Cleared).Select(x => x.Key).Should().Equal(Chambers.Letters);

        await ExchangeAsync(bond, bat.C, saruul.C, 4);
        (await Campaign(bat.C, bond)).Cleared.Should().Be(2, "the first seal broke at five each");
        var rooms = (await bat.C.GetFromJsonAsync<DeedPage>("/me/deeds?limit=100"))!.Items.Count(d => d.Kind == DeedKinds.CampaignRoom);
        rooms.Should().Be(2);
        (await Campaign(bat.C, bond)).Retire.Should().Be("none", "no encounter kept yet");
    }

    [Fact]
    public async Task A_pair_that_kept_their_word_retires_together_and_their_other_fires_go_out()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var other = await m.W.PersonAsync("Anu", "Female");
        var side = (await m.Bat.C.SummonAsync(other.Id)).Id;
        (await CodeOf(await m.Bat.C.PostAsync($"/bonds/{m.Bond}/retire", null))).Should().Be("retire.unavailable");

        var id = await m.AskedAsync();
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        var c = await Campaign(m.Bat.C, m.Bond);
        c.Chambers.Single(x => x.Key == Chambers.Boss).Cleared.Should().BeTrue();
        c.Retire.Should().Be("available");
        (await m.Bat.C.HonoursAsync()).Single(h => h.Key == HonourKeys.OathKeeper).Earned.Should().BeFalse("the boss is broken but the rite chamber is not cleared");

        (await m.Bat.C.PostAsync($"/bonds/{m.Bond}/retire", null)).EnsureSuccessStatusCode();
        (await Campaign(m.Saruul.C, m.Bond)).Retire.Should().Be("askedByThem");
        (await CodeOf(await m.Bat.C.PostAsync($"/bonds/{m.Bond}/retire/yes", null))).Should().Be("retire.not_asked");
        (await m.Saruul.C.PostAsync($"/bonds/{m.Bond}/retire/yes", null)).EnsureSuccessStatusCode();

        (await m.Bat.C.BondAsync(m.Bond)).State.Should().Be("Retired");
        var cut = await other.C.BondAsync(side);
        (cut.State, cut.ClosedWhy).Should().Be(("Severed", "retired"));
        (await m.Saruul.C.HonoursAsync()).Single(h => h.Key == HonourKeys.Hearthbound).Earned.Should().BeTrue();
        var hall = (await other.C.GetFromJsonAsync<HallView>("/hall"))!;
        hall.RetiredPairs.Should().Be(1);
        hall.Top.Should().HaveCount(1, "the retired pair left the hall");
    }

    [Fact]
    public async Task The_weeks_exchange_opens_both_answers_together_and_pays_each()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        (await bat.C.GetAsync($"/bonds/{bond}/weekly")).StatusCode.Should().Be(System.Net.HttpStatusCode.NoContent, "before the first seal");
        await ExchangeAsync(bond, bat.C, saruul.C, 5);

        var t = (await bat.C.GetFromJsonAsync<WeeklyTrialView>($"/bonds/{bond}/weekly"))!;
        t.Kind.Should().Be("exchange");
        t.Games.Should().ContainSingle().Which.Prompt.Should().NotBeNullOrEmpty();
        (await bat.C.PostAsJsonAsync($"/bonds/{bond}/weekly/0", new WeeklyAnswerRequest("A river", null, null))).EnsureSuccessStatusCode();
        (await saruul.C.GetFromJsonAsync<WeeklyTrialView>($"/bonds/{bond}/weekly"))!.Games[0]
            .Should().Match<GameView>(g => g.TheyAnswered && g.TheirText == null, "hidden until both answered");
        var before = await saruul.C.PointsAsync();
        var done = await (await saruul.C.PostAsJsonAsync($"/bonds/{bond}/weekly/0", new WeeklyAnswerRequest("A song", null, null)))
            .Content.ReadFromJsonAsync<WeeklyTrialView>();
        done!.Games[0].Should().Match<GameView>(g => g.TheirText == "A river" && g.Paid);
        (await saruul.C.PointsAsync()).Should().BeGreaterThanOrEqualTo(before + 25);
        (await CodeOf(await bat.C.PostAsJsonAsync($"/bonds/{bond}/weekly/0", new WeeklyAnswerRequest("Again", null, null))))
            .Should().Be("weekly.answered");
    }

    [Fact]
    public async Task During_the_naadam_the_week_holds_three_games_and_a_late_speed_answer_earns_nothing()
    {
        await using var w = await World.CreateAsync(db);
        await using (var scope = w.F.Services.CreateAsyncScope())
        {
            var dbx = scope.ServiceProvider.GetRequiredService<AppDb>();
            var today = w.F.Clock.TodayUb;
            dbx.Add(new Festival
                { Id = Guid.CreateVersion7(), Key = "naadam", Starts = today, Ends = today.AddDays(2) });
            await dbx.SaveChangesAsync();
        }
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 5);

        var t = (await bat.C.GetFromJsonAsync<WeeklyTrialView>($"/bonds/{bond}/weekly"))!;
        t.Kind.Should().Be("threeGames");
        t.Games.Select(g => g.Kind).Should().Equal("strength", "aim", "speed");
        t.Games[1].Choices.Should().HaveCount(4);

        async Task Answer(HttpClient c, int game, WeeklyAnswerRequest r) =>
            (await c.PostAsJsonAsync($"/bonds/{bond}/weekly/{game}", r)).EnsureSuccessStatusCode();
        await Answer(bat.C, 0, new(null, 0, null));
        await Answer(saruul.C, 0, new(null, 1, null));
        await Answer(bat.C, 1, new(null, 2, 3));
        await Answer(saruul.C, 1, new(null, 3, 2));
        (await bat.C.PostAsync($"/bonds/{bond}/weekly/speed/open", null)).EnsureSuccessStatusCode();
        await Answer(bat.C, 2, new("Quick", null, null));
        (await saruul.C.PostAsync($"/bonds/{bond}/weekly/speed/open", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromMinutes(61));
        await Answer(saruul.C, 2, new("Too slow", null, null));

        var games = (await bat.C.GetFromJsonAsync<WeeklyTrialView>($"/bonds/{bond}/weekly"))!.Games;
        games.Select(g => g.Paid).Should().Equal(true, true, false);
        games[1].Should().Match<GameView>(g => g.TheirChoice == 3 && g.TheirGuess == 2);
        var paid = (await bat.C.GetFromJsonAsync<DeedPage>("/me/deeds?limit=100"))!.Items.Count(d => d.Kind == DeedKinds.WeeklyTrial);
        paid.Should().Be(2);
    }

    private static async Task<CampaignView> Campaign(HttpClient c, Guid bond) =>
        (await c.GetFromJsonAsync<CampaignView>($"/bonds/{bond}/campaign"))!;
}
