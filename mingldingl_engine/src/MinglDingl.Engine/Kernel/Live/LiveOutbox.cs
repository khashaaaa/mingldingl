using System.Data.Common;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MinglDingl.Engine.Features.Live;

namespace MinglDingl.Engine.Kernel.Live;

/// Scoped: one per request. Holds events until the request's database work commits.
public sealed class LiveOutbox(IHubContext<LiveHub> app, IHubContext<AdminLiveHub> admin, ILogger<LiveOutbox> log) : ILiveOutbox
{
    private readonly List<(bool Admin, string Group, LiveEvent Event)> _held = [];

    public void ToAccount(Guid accountId, string kind, params Guid[] ids) => _held.Add((false, LiveGroups.Account(accountId), new(kind, ids)));
    public void ToSession(Guid deviceSessionId, string kind, params Guid[] ids) => _held.Add((false, LiveGroups.Session(deviceSessionId), new(kind, ids)));
    public void ToAdmins(string kind, params Guid[] ids) => _held.Add((true, LiveGroups.Admins, new(kind, ids)));
    public void ToAll(string kind) => _held.Add((false, LiveGroups.All, new(kind, [])));

    internal void Discard() => _held.Clear();

    internal async Task FlushAsync()
    {
        if (_held.Count == 0) return;
        var batch = _held.Distinct().ToList();
        _held.Clear();
        foreach (var (isAdmin, group, e) in batch)
        {
            try
            {
                var clients = isAdmin ? admin.Clients.Group(group) : app.Clients.Group(group);
                await clients.SendAsync("event", e);
            }
            catch (Exception ex) // a dropped push must never fail the write that caused it
            {
                log.LogWarning(ex, "Live send failed for {Kind}", e.Kind);
            }
        }
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
