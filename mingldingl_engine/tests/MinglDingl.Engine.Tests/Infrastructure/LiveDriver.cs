using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Live;

namespace MinglDingl.Engine.Tests.Infrastructure;

public sealed class LiveListener : IAsyncDisposable
{
    public HubConnection Connection { get; }
    public ConcurrentQueue<(LiveEvent Event, DateTimeOffset At)> Received { get; } = new();

    public LiveListener(HubConnection c)
    {
        Connection = c;
        c.On<LiveEvent>("event", e => Received.Enqueue((e, DateTimeOffset.UtcNow)));
    }

    public async Task<LiveEvent?> WaitForAsync(string kind, TimeSpan? timeout = null)
    {
        var until = DateTimeOffset.UtcNow + (timeout ?? TimeSpan.FromSeconds(3));
        while (DateTimeOffset.UtcNow < until)
        {
            var hit = Received.FirstOrDefault(r => r.Event.Kind == kind);
            if (hit.Event is not null) return hit.Event;
            await Task.Delay(25);
        }
        return null;
    }

    public ValueTask DisposeAsync() => Connection.DisposeAsync();
}

public static class LiveDriver
{
    public static async Task<LiveListener> ListenAsync(this EngineFactory f, string? accessToken, string path = "/live")
    {
        var conn = new HubConnectionBuilder()
            .WithUrl(new Uri(f.Server.BaseAddress, path), o =>
            {
                o.HttpMessageHandlerFactory = _ => f.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult(accessToken);
            })
            .Build();
        var listener = new LiveListener(conn);
        await conn.StartAsync();
        return listener;
    }

    public static Task<LiveListener> ListenAsync(this EngineFactory f, SessionPair s) => f.ListenAsync(s.AccessToken);
}
