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
/// the HTTP round-trip (up to the client timeout when Expo is slow) happens here, in queue order,
/// with whatever has queued up meanwhile sent together — Expo takes up to
/// <see cref="ExpoBatchLimit"/> messages per request, and one POST per recipient made every
/// fan-out (a Town Square start, the ghosting sweep) drain at one Expo round trip per person. Expo answers with one ticket per message, and a
/// <c>DeviceNotRegistered</c> ticket means the app is gone from that device, so the token is
/// dropped rather than retried forever.
/// </summary>
public sealed class PushDispatchBackgroundService : BackgroundService, IPushDispatcher
{
    public const string HttpClientName = "expo-push";

    /// <summary>
    /// The Android notification channel the app creates at launch. Must stay in step with
    /// <c>hooks/usePushNotifications.ts</c>: a channel id Android does not know is ignored.
    /// </summary>
    public const string AndroidChannelId = "default";

    /// <summary>Expo's documented maximum number of messages in one push request.</summary>
    public const int ExpoBatchLimit = 100;

    /// <summary>
    /// The queue is bounded so a stalled Expo cannot grow it without limit. Full drops the new push
    /// rather than blocking: `DispatchAsync` is awaited on request paths, and a request must never
    /// wait on someone else's notification.
    /// </summary>
    public const int QueueCapacity = 10_000;

    private readonly Channel<PushEnvelope> _queue = Channel.CreateBounded<PushEnvelope>(
        new BoundedChannelOptions(QueueCapacity) { SingleReader = true, FullMode = BoundedChannelFullMode.Wait });
    private long _dropped;
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

    public ValueTask DispatchAsync(PushEnvelope envelope, CancellationToken ct = default)
    {
        if (_queue.Writer.TryWrite(envelope)) return ValueTask.CompletedTask;
        // Logged on the first drop and then every hundredth, so the warning cannot itself become
        // the flood.
        long dropped = Interlocked.Increment(ref _dropped);
        if (dropped == 1 || dropped % 100 == 0)
            _logger.LogWarning("Push queue full ({Capacity}); {Dropped} pushes dropped so far", QueueCapacity, dropped);
        return ValueTask.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<PushEnvelope>();
        try
        {
            while (await _queue.Reader.WaitToReadAsync(stoppingToken))
            {
                batch.Clear();
                int messages = 0;
                while (messages < ExpoBatchLimit && _queue.Reader.TryRead(out var envelope))
                {
                    batch.Add(envelope);
                    messages += envelope.Tokens.Count;
                }
                await DeliverAsync(batch, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    internal Task DeliverAsync(PushEnvelope envelope, CancellationToken ct) => DeliverAsync([envelope], ct);

    internal async Task DeliverAsync(IReadOnlyList<PushEnvelope> envelopes, CancellationToken ct)
    {
        var messages = envelopes
            .SelectMany(e => e.Tokens.Select(token => (Token: token, Envelope: e)))
            .ToList();
        for (int i = 0; i < messages.Count; i += ExpoBatchLimit)
            await DeliverChunkAsync(messages.GetRange(i, Math.Min(ExpoBatchLimit, messages.Count - i)), ct);
    }

    private async Task DeliverChunkAsync(List<(string Token, PushEnvelope Envelope)> chunk, CancellationToken ct)
    {
        if (chunk.Count == 0) return;
        var tokens = chunk.Select(m => m.Token).ToList();

        var messages = chunk.Select(m => new
        {
            to = m.Token,
            title = m.Envelope.Title,
            body = m.Envelope.Body,
            data = m.Envelope.Data,
            // Android routes every notification through a channel and takes its importance from
            // there, not from the message. Naming the one the app creates on launch is what makes
            // these arrive as a heads-up with sound; unnamed, they land in Expo's fallback channel
            // at default importance and never surface over whatever is on screen.
            channelId = AndroidChannelId,
        });

        List<string> deadTokens;
        try
        {
            var content = new StringContent(JsonSerializer.Serialize(messages), System.Text.Encoding.UTF8, "application/json");
            using var response = await _httpFactory.CreateClient(HttpClientName).PostAsync("/--/api/v2/push/send", content, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            // A non-2xx from Expo used to be indistinguishable from a delivered push: the body was
            // parsed for tickets, none were found, and the method returned having logged nothing.
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Expo rejected a push batch of {TokenCount} with {Status}: {Body}",
                    tokens.Count, (int)response.StatusCode, Excerpt(responseBody));
                return;
            }
            deadTokens = DeadTokensIn(tokens, responseBody);
        }
        catch (Exception ex) when (!IsShutdown(ex, ct))
        {
            _logger.LogWarning(ex, "Push delivery swallowed a failure ({TokenCount} tokens)", tokens.Count);
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
    /// <para>
    /// Only <c>DeviceNotRegistered</c> prunes, but every other error status is logged. Silently
    /// discarding them meant a push that Expo refused — <c>MessageTooBig</c>, a rate limit, bad
    /// credentials — was indistinguishable from one it delivered, and "the notification just never
    /// arrived" had no trace anywhere to follow.
    /// </para>
    /// </summary>
    private List<string> DeadTokensIn(IReadOnlyList<string> tokens, string responseBody)
    {
        var dead = new List<string>();
        if (string.IsNullOrWhiteSpace(responseBody)) return dead;
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (!doc.RootElement.TryGetProperty("data", out var tickets) || tickets.ValueKind != JsonValueKind.Array)
            {
                _logger.LogWarning("Expo returned no ticket array for a push batch: {Body}", Excerpt(responseBody));
                return dead;
            }
            var i = 0;
            foreach (var ticket in tickets.EnumerateArray())
            {
                if (i >= tokens.Count) break;
                var error = ticket.TryGetProperty("details", out var details)
                    && details.ValueKind == JsonValueKind.Object
                    && details.TryGetProperty("error", out var errorNode)
                    ? errorNode.GetString()
                    : null;

                if (error == "DeviceNotRegistered") dead.Add(tokens[i]);
                else if (ticket.TryGetProperty("status", out var status) && status.GetString() == "error")
                    _logger.LogWarning(
                        "Expo refused one push: error={Error} message={Message}",
                        error ?? "(none)",
                        ticket.TryGetProperty("message", out var m) ? m.GetString() : "(none)");
                i++;
            }
        }
        catch (JsonException)
        {
            _logger.LogWarning("Expo returned an unparseable push response: {Body}", Excerpt(responseBody));
        }
        return dead;
    }

    /// <summary>Keeps a hostile or merely enormous response body from filling the log.</summary>
    private static string Excerpt(string body) =>
        string.IsNullOrEmpty(body) ? "(empty)"
        : body.Length <= 500 ? body
        : body[..500] + "…";
}
