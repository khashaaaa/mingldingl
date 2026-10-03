using System.Text.Json;
using System.Text;

public class SupabaseBroadcastService
{
    private readonly HttpClient _http;
    private readonly ILogger<SupabaseBroadcastService> _logger;
    private readonly bool _configured;

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public SupabaseBroadcastService(HttpClient http, IConfiguration config, ILogger<SupabaseBroadcastService> logger)
    {
        _logger = logger;
        _http = http;

        var projectUrl = config["Supabase:ProjectUrl"]?.TrimEnd('/');
        var secretKey = config["Supabase:SecretKey"];
        if (string.IsNullOrWhiteSpace(projectUrl) || !Uri.TryCreate(projectUrl, UriKind.Absolute, out var baseUri))
        {
            _configured = false;
            _logger.LogWarning("Supabase:ProjectUrl is not configured; realtime broadcasts are disabled");
            return;
        }

        _configured = true;
        _http.BaseAddress = baseUri;
        _http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", secretKey);
        _http.DefaultRequestHeaders.Add("apikey", secretKey);
    }

    public bool IsConfigured => _configured;

    /// <summary>
    /// The topic one user's app listens on for nudges and match-lifecycle events. Anything about a
    /// match goes to its participants' topics, never to a shared one: every client used to receive
    /// every user's message/icebreaker/quiz/date events on one `app-nudges` topic and filter locally.
    /// These are public channels, so the topic name is not an authorisation boundary on its own.
    /// </summary>
    public static string UserTopic(Guid userId) => $"user:{userId}";

    public Task BroadcastAsync(string topic, string eventName, object payload) =>
        SendAsync([new BroadcastEvent(topic, eventName, payload)]);

    /// <summary>One POST carrying the event to each distinct user's own topic.</summary>
    public Task BroadcastToUsersAsync(IEnumerable<Guid> userIds, string eventName, object payload) =>
        SendAsync(userIds.Distinct().Select(id => new BroadcastEvent(UserTopic(id), eventName, payload)).ToList());

    /// <summary>
    /// Several events in one POST. Each broadcast is an outbound HTTPS call the request waits on, so a
    /// write that announces itself on more than one topic sends them together rather than in series.
    /// </summary>
    public Task BroadcastManyAsync(IReadOnlyCollection<BroadcastEvent> events) => SendAsync(events);

    public static IEnumerable<BroadcastEvent> ToUsers(IEnumerable<Guid> userIds, string eventName, object payload) =>
        userIds.Distinct().Select(id => new BroadcastEvent(UserTopic(id), eventName, payload));

    private async Task SendAsync(IReadOnlyCollection<BroadcastEvent> events)
    {
        if (!_configured || events.Count == 0) return;
        try
        {
            var body = JsonSerializer.Serialize(new
            {
                messages = events.Select(e => new { topic = e.Topic, @event = e.Event, payload = e.Payload }).ToArray()
            }, JsonOptions);
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            await _http.PostAsync("/realtime/v1/api/broadcast", content);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Supabase broadcast swallowed a failure for topics {Topics} (events {Events})",
                string.Join(",", events.Select(e => e.Topic)), string.Join(",", events.Select(e => e.Event).Distinct()));
        }
    }
}

public sealed record BroadcastEvent(string Topic, string Event, object Payload);
