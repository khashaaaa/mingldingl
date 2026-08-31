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
        var a = User(hasKids: false, religion: "None");
        var b = User(hasKids: false);

        Assert.Equal(1.0, CompatibilityScorer.Score(a, b));
    }

    [Fact]
    public void Score_OrdinalHabits_PartialMismatchScoresBetweenZeroAndOne()
    {
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
        var a = User(hasKids: true, smoking: "Never", drinking: "Occasionally");
        var b = User(hasKids: true, smoking: "Never");

        Assert.Equal(1.0, CompatibilityScorer.Score(a, b));
    }
}
