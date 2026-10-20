using FluentAssertions;
using MinglDingl.Engine.Features.Festivals;

namespace MinglDingl.Engine.Tests.Features.Festivals;

public class WinterTests
{
    [Theory]
    // Solstice instants (UTC) → Ulaanbaatar days: 2025's falls an hour before UB midnight, 2026's after it.
    [InlineData(2024, 21)] // 09:20 UTC
    [InlineData(2025, 21)] // 15:03 UTC
    [InlineData(2026, 22)] // 20:50 UTC
    [InlineData(2027, 22)] // 02:42 UTC
    [InlineData(2028, 21)] // 08:19 UTC
    public void The_solstice_lands_on_its_ulaanbaatar_day(int year, int day) =>
        Winter.Solstice(year).Should().Be(new DateOnly(year, 12, day));

    [Fact]
    public void It_snows_from_the_solstice_through_january_20()
    {
        Winter.Snows(new(2026, 12, 21)).Should().BeFalse();
        Winter.Snows(new(2026, 12, 22)).Should().BeTrue();
        Winter.Snows(new(2027, 1, 1)).Should().BeTrue();
        Winter.Snows(new(2027, 1, 20)).Should().BeTrue();
        Winter.Snows(new(2027, 1, 21)).Should().BeFalse();
        Winter.Snows(new(2026, 10, 20)).Should().BeFalse();
    }
}
