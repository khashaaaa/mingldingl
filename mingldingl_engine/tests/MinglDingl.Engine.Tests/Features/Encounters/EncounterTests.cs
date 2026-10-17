using System.Net;
using FluentAssertions;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Encounters;

public class EncounterTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<(World W, World.Person Bat, World.Person Saruul, Guid Bond)> PairAsync(PostgresFixture db, int lettersEach)
    {
        var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, lettersEach);
        return (w, bat, saruul, bond);
    }

    [Fact]
    public async Task The_icebreaker_opens_with_the_bond_and_the_trial_waits_for_the_second_seal()
    {
        var (w, bat, _, bond) = await PairAsync(db, 0);
        await using var _w = w;
        var e = await bat.C.EncounterAsync(bond);
        e.Next.Should().Be("icebreaker", "Figma 31:3: a new bond offers \"Break the ice\"");
        e.Icebreaker.Should().NotBeNull();
        e.Trial.Should().BeNull();
        (await CodeOf(await bat.C.TrialRawAsync(bond, 0, 0))).Should().Be("trial.closed");
        e.Meeting.Should().BeNull();
    }

    [Fact]
    public async Task Icebreaker_answers_stay_sealed_until_both_answer_then_open_live_with_points()
    {
        var (w, bat, saruul, bond) = await PairAsync(db, 5);
        await using var _w = w;
        await using var hers = await w.F.ListenAsync(saruul.S);
        var e = await bat.C.EncounterAsync(bond);
        e.Next.Should().Be("icebreaker");
        e.Icebreaker!.Question.Should().NotBeNullOrEmpty();

        (await bat.C.IcebreakerRawAsync(bond, "Up the Terelj valley at first light.")).EnsureSuccessStatusCode();
        (await hers.WaitForAsync(LiveKinds.EncounterUpdated)).Should().NotBeNull();
        var waiting = await saruul.C.EncounterAsync(bond);
        waiting.Icebreaker!.Mine.Should().BeNull();
        waiting.Icebreaker.Theirs.Should().BeNull("his answer stays sealed until she answers");
        (await CodeOf(await bat.C.IcebreakerRawAsync(bond, "again"))).Should().Be("icebreaker.answered");

        var batBefore = await bat.C.PointsAsync();
        var herBefore = await saruul.C.PointsAsync();
        (await saruul.C.IcebreakerRawAsync(bond, "Khövsgöl in winter.")).EnsureSuccessStatusCode();
        var opened = await bat.C.EncounterAsync(bond);
        opened.Icebreaker!.Revealed.Should().BeTrue();
        opened.Icebreaker.Theirs.Should().Be("Khövsgöl in winter.");
        (await bat.C.PointsAsync()).Should().Be(batBefore + 20);
        (await saruul.C.PointsAsync()).Should().Be(herBefore + 20);
        opened.Rite!.State.Should().Be("open", "answering the icebreaker opens the Flame Rite");
        opened.Next.Should().Be("rite");
    }

    [Fact]
    public async Task The_trial_resumes_in_order_and_scores_the_pair()
    {
        var (w, bat, saruul, bond) = await PairAsync(db, 10);
        await using var _w = w;
        var e = await bat.C.EncounterAsync(bond);
        e.Trial!.Questions.Should().HaveCount(5);
        e.Trial.Questions.Should().OnlyContain(q => q.Choices.Count == 4 && q.Hints.Count == 4);

        (await bat.C.TrialRawAsync(bond, 0, 1)).EnsureSuccessStatusCode();
        (await CodeOf(await bat.C.TrialRawAsync(bond, 2, 1))).Should().Be("trial.order");
        (await CodeOf(await bat.C.TrialRawAsync(bond, 1, 4))).Should().Be("trial.choice");
        (await bat.C.EncounterAsync(bond)).Trial!.Mine.Should().Equal(1);
        for (var i = 1; i < 5; i++) (await bat.C.TrialRawAsync(bond, i, i % 4)).EnsureSuccessStatusCode();
        (await bat.C.EncounterAsync(bond)).Trial!.Result.Should().BeNull("she has not finished");

        var before = await saruul.C.PointsAsync();
        await saruul.C.TrialAllAsync(bond, 1, 1, 2, 0, 3); // his were 1, 1, 2, 3, 0: alike on the first three
        var result = (await saruul.C.EncounterAsync(bond)).Trial!.Result!;
        result.Same.Should().Be(3);
        result.Percent.Should().Be(60);
        result.SameTopics.Should().HaveCount(3);
        result.DifferTopics.Should().HaveCount(2);
        result.Theirs.Should().Equal(1, 1, 2, 3, 0);
        (await saruul.C.PointsAsync()).Should().Be(before + 15);
        (await CodeOf(await saruul.C.TrialRawAsync(bond, 5, 0))).Should().Be("trial.answered");
    }

    [Fact]
    public async Task A_bond_whose_seals_broke_before_a_step_existed_opens_it_on_first_look()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.IcebreakerSeal, "4");
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 5);
        (await bat.C.EncounterAsync(bond)).Icebreaker.Should().BeNull();

        await w.SetAsync(ConfigKeys.IcebreakerSeal, "1");
        (await bat.C.EncounterAsync(bond)).Icebreaker.Should().NotBeNull("five letters each broke the first seal");
    }

    [Fact]
    public async Task A_cold_bond_takes_no_more_answers()
    {
        var (w, bat, saruul, bond) = await PairAsync(db, 5);
        await using var _w = w;
        await w.AdvanceAsync(TimeSpan.FromHours(49));
        await w.SweepAsync();
        var r = await saruul.C.IcebreakerRawAsync(bond, "late");
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(r)).Should().Be("bond.closed");
        (await bat.C.EncounterAsync(bond)).Next.Should().BeNull();
    }
}
