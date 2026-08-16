using System.Text.Json;
using Microsoft.EntityFrameworkCore;

// Sends via Expo's push API (https://exp.host/--/api/v2/push/send), which
// fans out to APNs/FCM on Expo's side — no direct Apple/Google credentials
// needed on our end. Best-effort: a failed send never blocks the action
// that triggered it (a match/message already succeeded by the time this runs).
public class PushNotificationService
{
    private readonly HttpClient _http;
    private readonly AppDbContext _db;

    public PushNotificationService(HttpClient http, AppDbContext db)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://exp.host");
        _db = db;
    }

    public async Task NotifyUserAsync(Guid userId, string title, string body, Dictionary<string, object>? data = null)
    {
        // Account-level preference (Settings screen), not per-device — checked
        // here so both call sites (new match, new message) get it for free
        // rather than needing to check it themselves. Folded into one query
        // with the token lookup below (a left join via SelectMany) instead of
        // two round trips — this runs on every match-created and
        // message-sent event.
        var tokens = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.PushEnabled)
            .SelectMany(u => _db.PushTokens.Where(t => t.UserId == userId).Select(t => t.Token))
            .ToListAsync();
        if (tokens.Count == 0) return;

        var messages = tokens.Select(token => new
        {
            to = token,
            title,
            body,
            data = data ?? new Dictionary<string, object>(),
        });

        try
        {
            var content = new StringContent(JsonSerializer.Serialize(messages), System.Text.Encoding.UTF8, "application/json");
            await _http.PostAsync("/--/api/v2/push/send", content);
        }
        catch
        {
            // Best-effort — a push failure shouldn't surface as an error on
            // whatever action (new match, new message) triggered it.
        }
    }
}
