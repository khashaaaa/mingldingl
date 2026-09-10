using Microsoft.EntityFrameworkCore;

public class PushNotificationService
{
    private readonly AppDbContext _db;
    private readonly IPushDispatcher _dispatcher;

    public PushNotificationService(AppDbContext db, IPushDispatcher dispatcher)
    {
        _db = db;
        _dispatcher = dispatcher;
    }

    /// <summary>
    /// Resolves one push kind for a user in their own language and hands it to the dispatcher;
    /// the Expo round-trip happens off the request path. `data` is forwarded to the app and
    /// always carries the kind's wire `type`, which the app routes on; `args` fill the copy's
    /// placeholders (a display name, a message body).
    /// </summary>
    public async Task NotifyUserAsync(Guid userId, PushKind kind, Dictionary<string, object>? data = null, params string[] args)
    {
        // A suspended account is not a recipient: it cannot open the app to act on anything it is
        // told, and a stream of "you have a new message" to someone who has been thrown out is
        // worse than silence. Same for one already past its deletion request.
        var recipient = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId && u.PushEnabled && !u.IsBanned && u.DeletionRequestedAt == null)
            .Select(u => new { u.PreferredLocale, Tokens = _db.PushTokens.Where(t => t.UserId == userId).Select(t => t.Token).ToList() })
            .FirstOrDefaultAsync();
        if (recipient is null || recipient.Tokens.Count == 0) return;

        var (title, body) = PushCopy.For(kind, recipient.PreferredLocale, args);
        var payload = new Dictionary<string, object>(data ?? new Dictionary<string, object>())
        {
            ["type"] = PushCopy.WireType(kind),
        };
        await _dispatcher.DispatchAsync(new PushEnvelope(recipient.Tokens, title, body, payload));
    }
}
