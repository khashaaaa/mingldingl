using Microsoft.EntityFrameworkCore;

public class TownSquareSchedulerBackgroundService : BackgroundService
{
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
            await RunPerSessionAsync(sessionId, "lock roster", () => townSquare.LockRosterAsync(sessionId));

        var dueToStart = await db.TownSquareSessions
            .Where(s => s.Status == "Locked" && s.ScheduledStartAt <= now)
            .Select(s => s.Id)
            .ToListAsync(ct);
        foreach (var sessionId in dueToStart)
            await RunPerSessionAsync(sessionId, "start session", () => townSquare.StartSessionAsync(sessionId));

        var inProgress = await db.TownSquareSessions
            .Where(s => s.Status == "InProgress")
            .ToListAsync(ct);
        foreach (var session in inProgress)
        {
            var currentRound = await db.TownSquareRounds
                .FirstOrDefaultAsync(r => r.SessionId == session.Id && r.RoundNumber == session.CurrentRoundNumber, ct);
            if (currentRound is not null && currentRound.StartsAt.AddSeconds(currentRound.DurationSeconds) <= now)
                await RunPerSessionAsync(session.Id, "advance round", () => townSquare.AdvanceRoundAsync(session.Id));
        }
    }

    /// <summary>
    /// One broken session must not stall the others. The sweep runs every 10s and a session it
    /// cannot advance stays in the same state, so an escaping exception is not a one-off — it
    /// re-throws forever and no session on the instance ever progresses again.
    /// </summary>
    private async Task RunPerSessionAsync(Guid sessionId, string step, Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Town Square sweep step '{Step}' failed for session {SessionId}", step, sessionId);
        }
    }
}
