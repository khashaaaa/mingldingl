using System.Text.Json;
using Microsoft.EntityFrameworkCore;

public class PushNotificationService
{
    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(HttpClient http, AppDbContext db, ILogger<PushNotificationService> logger)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://exp.host");
        _db = db;
        _logger = logger;
    }

    public async Task NotifyUserAsync(Guid userId, string title, string body, Dictionary<string, object>? data = null)
    {
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Push notification send swallowed a failure for user {UserId} ({TokenCount} tokens)", userId, tokens.Count);
        }
    }
}
