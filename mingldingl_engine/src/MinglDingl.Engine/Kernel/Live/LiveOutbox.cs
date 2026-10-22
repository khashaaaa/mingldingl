using System.Data.Common;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MinglDingl.Engine.Features.Live;

namespace MinglDingl.Engine.Kernel.Live;

/// Scoped: one per request. Holds events until the request's database work commits, then sends
/// each group one message with its distinct events.
public sealed class LiveOutbox(
    IHubContext<LiveHub> app, IHubContext<AdminLiveHub> admin, IHttpContextAccessor http, ILogger<LiveOutbox> log) : ILiveOutbox
{
    /// The app names each write (a random id); its echo comes back with that name.
    public const string OriginHeader = "X-Live-Origin";

    private readonly List<(bool Admin, string Group, LiveEvent Event)> _held = [];

    public void ToAccount(Guid accountId, string kind, params Guid[] ids) => _held.Add((false, LiveGroups.Account(accountId), new(kind, ids)));
    public void ToSession(Guid deviceSessionId, string kind, params Guid[] ids) => _held.Add((false, LiveGroups.Session(deviceSessionId), new(kind, ids)));
    public void ToAdmins(string kind, params Guid[] ids) => _held.Add((true, LiveGroups.Admins, new(kind, ids)));
    public void ToAll(string kind) => _held.Add((false, LiveGroups.All, new(kind, [])));

    internal void Discard() => _held.Clear();

    internal async Task FlushAsync()
    {
        if (_held.Count == 0) return;
        var groups = _held.GroupBy(h => (h.Admin, h.Group))
            .Select(g => (g.Key.Admin, g.Key.Group, Events: g.Select(h => h.Event).Distinct().ToList())).ToList();
        _held.Clear();
        var origin = Origin();
        foreach (var (isAdmin, group, events) in groups)
        {
            try
            {
                var clients = isAdmin ? admin.Clients.Group(group) : app.Clients.Group(group);
                await clients.SendAsync("events", new LiveBatch(events, isAdmin ? null : origin, group == LiveGroups.All));
                // App builds from before the batch listen for one "event" each; drop once they have all updated.
                if (!isAdmin) foreach (var e in events) await clients.SendAsync("event", e);
            }
            catch (Exception ex) // a dropped push must never fail the write that caused it
            {
                log.LogWarning(ex, "Live send failed for {Kinds}", string.Join(",", events.Select(e => e.Kind)));
            }
        }
    }

    private string? Origin()
    {
        var v = http.HttpContext?.Request.Headers[OriginHeader].ToString();
        return v is { Length: > 0 and <= 64 } && v.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_') ? v : null;
    }
}

/// Sends held events after SaveChanges when no transaction is open, or after the transaction
/// commits; drops them on rollback. An event can therefore never describe data a reader cannot see.
/// Pushes ride the same rule.
public sealed class LiveFlushInterceptor(LiveOutbox outbox, Push.PushOutbox push) : SaveChangesInterceptor, IDbTransactionInterceptor
{
    public override async ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData e, int result, CancellationToken ct = default)
    {
        if (e.Context?.Database.CurrentTransaction is null) await FlushAsync();
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData e) { if (e.Context?.Database.CurrentTransaction is null) Discard(); }
    public override Task SaveChangesFailedAsync(DbContextErrorEventData e, CancellationToken ct = default) { SaveChangesFailed(e); return Task.CompletedTask; }

    public async Task TransactionCommittedAsync(DbTransaction t, TransactionEndEventData e, CancellationToken ct = default) => await FlushAsync();
    public void TransactionCommitted(DbTransaction t, TransactionEndEventData e) => FlushAsync().GetAwaiter().GetResult();
    public Task TransactionRolledBackAsync(DbTransaction t, TransactionEndEventData e, CancellationToken ct = default) { Discard(); return Task.CompletedTask; }
    public void TransactionRolledBack(DbTransaction t, TransactionEndEventData e) => Discard();
    public Task TransactionFailedAsync(DbTransaction t, TransactionErrorEventData e, CancellationToken ct = default) { Discard(); return Task.CompletedTask; }
    public void TransactionFailed(DbTransaction t, TransactionErrorEventData e) => Discard();

    private async Task FlushAsync()
    {
        push.Flush();
        await outbox.FlushAsync();
    }

    private void Discard()
    {
        push.Discard();
        outbox.Discard();
    }
}
