using FluentAssertions;
using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Tests.Kernel;

public class ClockTests
{
    [Fact]
    public void TodayUb_rolls_over_at_ulaanbaatar_midnight()
    {
        new SystemClock(() => DateTimeOffset.Parse("2026-10-05T16:30:00Z")).TodayUb
            .Should().Be(new DateOnly(2026, 10, 6));
        new SystemClock(() => DateTimeOffset.Parse("2026-10-05T15:59:00Z")).TodayUb
            .Should().Be(new DateOnly(2026, 10, 5));
    }
}
