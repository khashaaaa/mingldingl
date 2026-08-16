using System.Text.Json;
using System.Text;

// Pushes live events to already-connected clients via Supabase Realtime's
// Broadcast API — NOT postgres_changes (which only observes Supabase's own
// hosted Postgres, and stopped firing once messages/matches moved to local
// Postgres). Broadcast is topic/event based and works over HTTP regardless
// of where the data actually lives; the client subscribes with
// `.on('broadcast', { event }, ...)` on the same channel name used here.
// Best-effort: a failed push never blocks the action that triggered it — the
// data is already saved, the client just falls back to its next fetch.
public class SupabaseBroadcastService
{
    private readonly HttpClient _http;
    // The client reads payload fields as camelCase (parseMessage, etc.) — the
    // default JsonSerializer.Serialize preserves C# PascalCase member names
    // as-is, which silently produced payloads the client couldn't read
    // (e.g. "MatchId" instead of "matchId").
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public SupabaseBroadcastService(HttpClient http, IConfiguration config)
    {
        var projectUrl = config["Supabase:ProjectUrl"]!.TrimEnd('/');
        var secretKey = config["Supabase:SecretKey"];
        _http = http;
        _http.BaseAddress = new Uri(projectUrl);
        _http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", secretKey);
        _http.DefaultRequestHeaders.Add("apikey", secretKey);
    }

    public async Task BroadcastAsync(string topic, string eventName, object payload)
    {
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
        catch
        {
            // Best-effort — see class comment.
        }
    }
}
