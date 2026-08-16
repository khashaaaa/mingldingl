namespace MinglDingl.Engine.Tests;

public class TownSquareServiceTests
{
    [Fact]
    public void GenerateRoundRobin_FiveMenFiveWomen_ReturnsFiveRoundsOfFivePairsEach()
    {
        var men = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();
        var women = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();

        var rounds = TownSquareService.GenerateRoundRobin(men, women);

        Assert.Equal(5, rounds.Count);
        Assert.All(rounds, round => Assert.Equal(5, round.Count));
    }

    [Fact]
    public void GenerateRoundRobin_FiveMenFiveWomen_EveryManMeetsEveryWomanExactlyOnce()
    {
        var men = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();
        var women = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();

        var rounds = TownSquareService.GenerateRoundRobin(men, women);
        var allPairs = rounds.SelectMany(r => r).ToList();

        foreach (var man in men)
        {
            var partners = allPairs.Where(p => p.UserAId == man).Select(p => p.UserBId).ToList();
            Assert.Equal(women.OrderBy(g => g), partners.OrderBy(g => g));
        }
    }

    [Fact]
    public void GenerateRoundRobin_ThreeMenThreeWomen_ReturnsThreeRounds()
    {
        var men = Enumerable.Range(0, 3).Select(_ => Guid.NewGuid()).ToList();
        var women = Enumerable.Range(0, 3).Select(_ => Guid.NewGuid()).ToList();

        var rounds = TownSquareService.GenerateRoundRobin(men, women);

        Assert.Equal(3, rounds.Count);
        Assert.All(rounds, round => Assert.Equal(3, round.Count));
    }

    [Fact]
    public void GenerateRoundRobin_UnequalCounts_ThrowsArgumentException()
    {
        var men = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();
        var women = Enumerable.Range(0, 4).Select(_ => Guid.NewGuid()).ToList();

        Assert.Throws<ArgumentException>(() => TownSquareService.GenerateRoundRobin(men, women));
    }
}
