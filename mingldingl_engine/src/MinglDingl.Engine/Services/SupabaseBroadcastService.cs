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

    public async Task BroadcastAsync(string topic, string eventName, object payload)
    {
        if (!_configured) return;
        try
        {
            var body = JsonSerializer.Serialize(new
            {
                messages = new[]
                {
                    new { topic, @event = eventName, payload }
                }
            }, JsonOptions);
            using var content = new StringContent(body, Encoding.UTF8, "application/json");
            await _http.PostAsync("/realtime/v1/api/broadcast", content);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Supabase broadcast swallowed a failure for topic {Topic} (event {Event})", topic, eventName);
        }
    }
}
