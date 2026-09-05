using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;

/// <summary>One localised push, already resolved to the device tokens it goes to.</summary>
public sealed record PushEnvelope(
    IReadOnlyList<string> Tokens,
    string Title,
    string Body,
    IReadOnlyDictionary<string, object> Data);

public interface IPushDispatcher
{
    ValueTask DispatchAsync(PushEnvelope envelope, CancellationToken ct = default);
}

/// <summary>
/// Delivers pushes to Expo off the request path. A controller only pays for the recipient lookup;
/// the HTTP round-trip (up to the client timeout when Expo is slow) happens here, one envelope at
/// a time in the order they were queued. Expo answers with one ticket per message, and a
/// <c>DeviceNotRegistered</c> ticket means the app is gone from that device, so the token is
/// dropped rather than retried forever.
/// </summary>
public sealed class PushDispatchBackgroundService : BackgroundService, IPushDispatcher
{
    public const string HttpClientName = "expo-push";

    private readonly Channel<PushEnvelope> _queue = Channel.CreateUnbounded<PushEnvelope>(
        new UnboundedChannelOptions { SingleReader = true });
    private readonly IHttpClientFactory _httpFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PushDispatchBackgroundService> _logger;

    public PushDispatchBackgroundService(
        IHttpClientFactory httpFactory,
        IServiceScopeFactory scopeFactory,
        ILogger<PushDispatchBackgroundService> logger)
    {
        _httpFactory = httpFactory;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public ValueTask DispatchAsync(PushEnvelope envelope, CancellationToken ct = default) =>
        _queue.Writer.WriteAsync(envelope, ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var envelope in _queue.Reader.ReadAllAsync(stoppingToken))
                await DeliverAsync(envelope, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    internal async Task DeliverAsync(PushEnvelope envelope, CancellationToken ct)
    {
        if (envelope.Tokens.Count == 0) return;

        var messages = envelope.Tokens.Select(token => new
        {
            to = token,
            title = envelope.Title,
            body = envelope.Body,
            data = envelope.Data,
        });

        List<string> deadTokens;
        try
        {
            var content = new StringContent(JsonSerializer.Serialize(messages), System.Text.Encoding.UTF8, "application/json");
            using var response = await _httpFactory.CreateClient(HttpClientName).PostAsync("/--/api/v2/push/send", content, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            deadTokens = DeadTokensIn(envelope.Tokens, responseBody);
        }
        catch (Exception ex) when (!IsShutdown(ex, ct))
        {
            _logger.LogWarning(ex, "Push delivery swallowed a failure ({TokenCount} tokens)", envelope.Tokens.Count);
            return;
        }

        if (deadTokens.Count == 0) return;
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var removed = await db.PushTokens.Where(t => deadTokens.Contains(t.Token)).ExecuteDeleteAsync(ct);
            _logger.LogInformation("Pruned {Count} push tokens Expo reported as DeviceNotRegistered", removed);
        }
        catch (Exception ex) when (!IsShutdown(ex, ct))
        {
            _logger.LogWarning(ex, "Failed to prune {Count} dead push tokens", deadTokens.Count);
        }
    }

    /// <summary>
    /// Only *our own* shutdown is worth propagating. `HttpClient` reports its `Timeout` as a
    /// `TaskCanceledException`, which is an `OperationCanceledException` too — swallowing by type
    /// alone let a slow Expo escape `DeliverAsync`, fault the background task, and (on .NET's
    /// default `BackgroundServiceExceptionBehavior.StopHost`) take the engine down with it.
    /// </summary>
    private static bool IsShutdown(Exception ex, CancellationToken ct) =>
        ex is OperationCanceledException && ct.IsCancellationRequested;

    /// <summary>
    /// Expo's tickets come back in the same order as the messages sent, so a token is matched to
    /// its ticket by position. Anything unparseable is treated as "no ticket": never prune on a
    /// guess.
    /// </summary>
    private static List<string> DeadTokensIn(IReadOnlyList<string> tokens, string responseBody)
    {
        var dead = new List<string>();
        if (string.IsNullOrWhiteSpace(responseBody)) return dead;
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("data", out var tickets) || tickets.ValueKind != JsonValueKind.Array) return dead;
            var i = 0;
            foreach (var ticket in tickets.EnumerateArray())
            {
                if (i >= tokens.Count) break;
                if (ticket.TryGetProperty("details", out var details)
                    && details.ValueKind == JsonValueKind.Object
                    && details.TryGetProperty("error", out var error)
                    && error.GetString() == "DeviceNotRegistered")
                    dead.Add(tokens[i]);
                i++;
            }
        }
        catch (JsonException)
        {
        }
        return dead;
    }
}
