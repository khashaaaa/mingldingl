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
        SendAsync([topic], eventName, payload);

    /// <summary>One POST carrying the event to each distinct user's own topic.</summary>
    public Task BroadcastToUsersAsync(IEnumerable<Guid> userIds, string eventName, object payload) =>
        SendAsync(userIds.Distinct().Select(UserTopic).ToList(), eventName, payload);

    private async Task SendAsync(IReadOnlyCollection<string> topics, string eventName, object payload)
    {
        if (!_configured || topics.Count == 0) return;
        try
        {
            var body = JsonSerializer.Serialize(new
            {
                messages = topics.Select(topic => new { topic, @event = eventName, payload }).ToArray()
            }, JsonOptions);
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            await _http.PostAsync("/realtime/v1/api/broadcast", content);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Supabase broadcast swallowed a failure for topics {Topics} (event {Event})", string.Join(",", topics), eventName);
        }
    }
}
