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

    /// <summary>
    /// The Android notification channel the app creates at launch. Must stay in step with
    /// <c>hooks/usePushNotifications.ts</c>: a channel id Android does not know is ignored.
    /// </summary>
    public const string AndroidChannelId = "default";

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
                    envelope.Tokens.Count, (int)response.StatusCode, Excerpt(responseBody));
                return;
            }
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
