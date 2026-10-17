using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Tests.Infrastructure;

public sealed class TestClock : IClock
{
    private readonly SystemClock _inner;
    public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-10-05T04:00:00Z");
    public TestClock() => _inner = new SystemClock(() => Now);
    public DateTimeOffset UtcNow => Now;
    public DateOnly TodayUb => _inner.TodayUb;
    public void Advance(TimeSpan by) => Now = Now.Add(by);
}
