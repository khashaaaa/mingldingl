using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MinglDingl.Engine.Tests;

public class MilestoneServiceTests
{
    [Fact]
    public void Defs_HasSevenUniqueMilestonesWithPositiveXp()
    {
        Assert.Equal(7, MilestoneService.Defs.Count);
        Assert.Equal(7, MilestoneService.Defs.Select(d => d.Id).Distinct().Count());
        Assert.All(MilestoneService.Defs, d => Assert.True(d.Xp > 0));
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception), exception));
    }

    [Fact]
    public async Task AchieveAsync_DatabaseUnreachable_SwallowsButLogsWarning()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=1;Database=mingldingl;Username=postgres;Password=1234;Timeout=1")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options;
        await using var brokenDb = new AppDbContext(options);
        var logger = new CapturingLogger<MilestoneService>();
        var service = new MilestoneService(brokenDb, logger);

        await service.AchieveAsync(Guid.NewGuid(), "first_match");

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.NotNull(entry.Exception);
    }
}
