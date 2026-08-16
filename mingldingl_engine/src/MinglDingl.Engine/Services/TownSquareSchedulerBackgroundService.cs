using Microsoft.EntityFrameworkCore;

// Drives TownSquareSession lifecycle on a server-authoritative clock: locks the
// roster once RSVPs close, starts the session at its scheduled time, and
// advances rounds once each round's window elapses. Same thin-loop-plus-
// internal-sweep shape as DailyMaintenanceBackgroundService, for the same
// reason: it's what makes RunSweepAsync directly unit-testable.
public class TownSquareSchedulerBackgroundService : BackgroundService
{
    // Much shorter than DailyMaintenanceBackgroundService's hourly interval —
    // round transitions need to land within seconds of their real end time,
    // not once an hour.
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(10);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TownSquareSchedulerBackgroundService> _logger;

    public TownSquareSchedulerBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<TownSquareSchedulerBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunSweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Town Square scheduler sweep failed");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }

    internal async Task RunSweepAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var townSquare = scope.ServiceProvider.GetRequiredService<TownSquareService>();

        var now = DateTime.UtcNow;

        var dueToLock = await db.TownSquareSessions
            .Where(s => s.Status == "Open" && s.RsvpClosesAt <= now)
            .Select(s => s.Id)
            .ToListAsync(ct);
        foreach (var sessionId in dueToLock)
            await townSquare.LockRosterAsync(sessionId);

        var dueToStart = await db.TownSquareSessions
            .Where(s => s.Status == "Locked" && s.ScheduledStartAt <= now)
            .Select(s => s.Id)
            .ToListAsync(ct);
        foreach (var sessionId in dueToStart)
            await townSquare.StartSessionAsync(sessionId);

        var inProgress = await db.TownSquareSessions
            .Where(s => s.Status == "InProgress")
            .ToListAsync(ct);
        foreach (var session in inProgress)
        {
            var currentRound = await db.TownSquareRounds
                .FirstOrDefaultAsync(r => r.SessionId == session.Id && r.RoundNumber == session.CurrentRoundNumber, ct);
            if (currentRound is not null && currentRound.StartsAt.AddSeconds(currentRound.DurationSeconds) <= now)
                await townSquare.AdvanceRoundAsync(session.Id);
        }
    }
}
