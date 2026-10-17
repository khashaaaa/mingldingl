namespace MinglDingl.Engine.Features.Square;

/// Every two seconds: the square's boundary writes (SquareService.TickAsync). Cheap when nothing
/// is ringing — one indexed query for gatherings starting within the minute or running.
public sealed class SquareClock(IServiceScopeFactory scopes, ILogger<SquareClock> log) : BackgroundService
{
    public static readonly TimeSpan Every = TimeSpan.FromSeconds(2);

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<SquareService>().TickAsync(ct);
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(Every);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { await RunAsync(stop); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Square clock tick failed"); }
        }
    }
}
