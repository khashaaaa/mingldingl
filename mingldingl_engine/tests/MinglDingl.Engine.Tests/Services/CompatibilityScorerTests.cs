namespace MinglDingl.Engine.Tests.Services;

public class CompatibilityScorerTests
{
    private static User User(bool? hasKids = null, string? smoking = null, string? drinking = null, string? religion = null, string? lifestyle = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            DisplayName = "Test",
            Gender = "Female",
            City = "Ulaanbaatar",
            HasKids = hasKids,
            SmokingHabit = smoking,
            DrinkingHabit = drinking,
            Religion = religion,
            Lifestyle = lifestyle,
        };

    [Fact]
    public void Score_AllFieldsMatchExactly_ReturnsOne()
    {
        var a = User(hasKids: false, smoking: "Never", drinking: "Never", religion: "None", lifestyle: "Balanced");
        var b = User(hasKids: false, smoking: "Never", drinking: "Never", religion: "None", lifestyle: "Balanced");

        Assert.Equal(1.0, CompatibilityScorer.Score(a, b));
    }

    [Fact]
    public void Score_AllFieldsMaximallyDifferent_ReturnsZero()
    {
        var a = User(hasKids: false, smoking: "Never", drinking: "Never", religion: "None", lifestyle: "Relaxed");
        var b = User(hasKids: true, smoking: "Regularly", drinking: "Regularly", religion: "Christian", lifestyle: "Active");

        Assert.Equal(0.0, CompatibilityScorer.Score(a, b));
    }

    [Fact]
    public void Score_NeitherUserHasAnyDeepFields_ReturnsNull()
    {
        var a = User();
        var b = User();

        Assert.Null(CompatibilityScorer.Score(a, b));
    }

    [Fact]
    public void Score_OnlyOneSideHasAField_DoesNotCountThatField()
    {
        // b has never filled in a religion — comparing an unset field against
        // a set one is "unknown", not a mismatch, so it must be excluded from
        // the average rather than silently scored as 0.
        var a = User(hasKids: false, religion: "None");
        var b = User(hasKids: false);

        Assert.Equal(1.0, CompatibilityScorer.Score(a, b));
    }

    [Fact]
    public void Score_OrdinalHabits_PartialMismatchScoresBetweenZeroAndOne()
    {
        // "Never" vs "Occasionally" is one step apart on a 0-2 scale, so it
        // should score better than "Never" vs "Regularly" (two steps), not
        // collapse to the same 0 a plain equality check would give both.
        var never = User(smoking: "Never");
        var occasionally = User(smoking: "Occasionally");
        var regularly = User(smoking: "Regularly");

        var oneStepApart = CompatibilityScorer.Score(never, occasionally)!.Value;
        var twoStepsApart = CompatibilityScorer.Score(never, regularly)!.Value;

        Assert.Equal(0.5, oneStepApart);
        Assert.Equal(0.0, twoStepsApart);
        Assert.True(oneStepApart > twoStepsApart);
    }

    [Fact]
    public void Score_MixOfMatchingAndMissingFields_AveragesOnlyComparableOnes()
    {
        // Kids match (1.0), smoking matches (1.0), drinking is unset on b so
        // it's excluded — average should be over 2 fields, not penalized by
        // a 3rd field neither side can compare.
        var a = User(hasKids: true, smoking: "Never", drinking: "Occasionally");
        var b = User(hasKids: true, smoking: "Never");

        Assert.Equal(1.0, CompatibilityScorer.Score(a, b));
    }
}
