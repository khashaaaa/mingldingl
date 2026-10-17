using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Campaign;

/// A bond's Campaign (seven chambers cleared by deeds done together) and retiring together.
/// The services that make those deeds call SyncAsync inside their own transaction.
public sealed class CampaignService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score)
{
    /// Clears every chamber the bond has now reached and pays both sides for each. Runs in the
    /// caller's transaction (the bond row is already locked by it).
    public async Task SyncAsync(Bond b, CancellationToken ct = default)
    {
        var have = await db.Set<ChamberCleared>().Where(c => c.BondId == b.Id).Select(c => c.Chamber).ToListAsync(ct);
        var reached = await ReachedAsync(b, ct);
        var fresh = reached.Where(r => !have.Contains(r)).ToList();
        if (fresh.Count == 0) return;
        var now = clock.UtcNow;
        foreach (var c in fresh)
        {
            db.Add(new ChamberCleared { BondId = b.Id, Chamber = c, ClearedAt = now });
            var (kind, key) = c == Chambers.Boss
                ? (DeedKinds.CampaignBoss, ConfigKeys.ScoreCampaignBoss)
                : (DeedKinds.CampaignRoom, ConfigKeys.ScoreCampaignRoom);
            await db.SaveChangesAsync(ct);
            foreach (var who in new[] { b.AId, b.BId })
                await score.AwardAsync(who, kind, config.Int(key), b.Id, ct);
        }
        foreach (var who in new[] { b.AId, b.BId }) live.ToAccount(who, LiveKinds.CampaignUpdated, b.Id);
    }

    /// The first time campaigns exist, every bond's reached chambers are written without points.
    public static async Task BackfillAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        await using var scope = sp.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        if (await db.Set<ChamberCleared>().AnyAsync(ct)) return;
        var now = DateTimeOffset.UtcNow;
        var bonds = await db.Set<Bond>().AsNoTracking().Where(x => x.LettersA > 0 && x.LettersB > 0).ToListAsync(ct);
        var encounters = (await db.Set<Encounter>().AsNoTracking().ToListAsync(ct)).ToDictionary(e => e.BondId);
        var kept = (await db.Set<Meeting>().AsNoTracking().Where(m => m.Outcome == MeetingOutcome.Kept)
            .Select(m => m.BondId).Distinct().ToListAsync(ct)).ToHashSet();
        foreach (var b in bonds)
            foreach (var c in Reached(b, encounters.GetValueOrDefault(b.Id), kept.Contains(b.Id)))
                db.Add(new ChamberCleared { BondId = b.Id, Chamber = c, ClearedAt = now });
        await db.SaveChangesAsync(ct);
    }

    private async Task<List<string>> ReachedAsync(Bond b, CancellationToken ct)
    {
        var e = await db.Set<Encounter>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == b.Id, ct);
        var kept = await db.Set<Meeting>().AsNoTracking().AnyAsync(m => m.BondId == b.Id && m.Outcome == MeetingOutcome.Kept, ct);
        return Reached(b, e, kept);
    }

    private static List<string> Reached(Bond b, Encounter? e, bool kept)
    {
        var reached = new List<string>();
        if (b.Mutual >= 1) reached.Add(Chambers.Letters);
        if (b.Seals >= 1) reached.Add(Chambers.FirstSeal);
        if (e?.IcebreakerRevealedAt is not null) reached.Add(Chambers.Icebreaker);
        if (e?.TrialDoneAt is not null) reached.Add(Chambers.Trial);
        if (e?.RiteDoneAt is not null) reached.Add(Chambers.Rite);
        if (b.Seals >= 3) reached.Add(Chambers.ThirdSeal);
        if (kept) reached.Add(Chambers.Boss);
        return reached;
    }

    public async Task<CampaignView> GetAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var done = await db.Set<ChamberCleared>().AsNoTracking().Where(c => c.BondId == bondId).ToListAsync(ct);
        var chambers = Chambers.All.Select(k =>
        {
            var c = done.FirstOrDefault(d => d.Chamber == k);
            return new ChamberView(k, c is not null, c?.ClearedAt);
        }).ToList();
        return new CampaignView(chambers, done.Count, await RetireStateAsync(b, me, ct));
    }

    private async Task<string> RetireStateAsync(Bond b, Guid me, CancellationToken ct)
    {
        if (b.State != BondState.Live) return "none";
        if (b.RetireBy is { } by) return by == me ? "askedByMe" : "askedByThem";
        var kept = await db.Set<Meeting>().AsNoTracking().AnyAsync(m => m.BondId == b.Id && m.Outcome == MeetingOutcome.Kept, ct);
        return kept ? "available" : "none";
    }

    // —— Retire together ——

    public async Task<CampaignView> AskRetireAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await LockLiveAsync(me, bondId, ct);
        if (await RetireStateAsync(b, me, ct) != "available")
            throw new DomainException(409, "retire.unavailable", "Retiring opens after an encounter you both kept");
        b.RetireBy = me;
        b.RetireAt = clock.UtcNow;
        b.RetireDeclinedAt = null;
        await db.SaveChangesAsync(ct);
        var other = b.Other(me);
        foreach (var who in new[] { me, other }) live.ToAccount(who, LiveKinds.CampaignUpdated, b.Id);
        var name = await db.Set<Profile.Profile>().Where(p => p.AccountId == me).Select(p => p.Name).SingleAsync(ct);
        push.Send(other, PushKinds.RetireAsked, b.Id, name);
        await tx.CommitAsync(ct);
        return await GetAsync(me, bondId, ct);
    }

    public async Task<CampaignView> AnswerRetireAsync(Guid me, Guid bondId, bool yes, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await LockLiveAsync(me, bondId, ct);
        if (b.RetireBy is not { } asker || asker == me)
            throw new DomainException(409, "retire.not_asked", "No one has asked to retire");
        var now = clock.UtcNow;
        if (!yes)
        {
            b.RetireBy = null;
            b.RetireAt = null;
            b.RetireDeclinedAt = now;
        }
        else
        {
            // Both leave the search; this bond is complete; their other fires go out quietly.
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE profiles SET "RetiredAt" = {now}, "PausedAt" = COALESCE("PausedAt", {now})
                WHERE "AccountId" IN ({b.AId}, {b.BId})
                """, ct);
            Close(b, BondState.Retired, me, null);
            var others = await db.Set<Bond>().FromSqlInterpolated($"""
                SELECT * FROM bonds WHERE "State" = 'Live' AND "Id" <> {b.Id}
                AND ("AId" IN ({b.AId}, {b.BId}) OR "BId" IN ({b.AId}, {b.BId})) FOR UPDATE
                """).ToListAsync(ct);
            foreach (var o in others)
                Close(o, BondState.Severed, o.Has(b.AId) ? b.AId : b.BId, "retired");
            foreach (var who in new[] { b.AId, b.BId })
            {
                live.ToAccount(who, LiveKinds.ProfileUpdated, who);
                live.ToAdmins(LiveKinds.UserUpdated, who);
            }
        }
        foreach (var who in new[] { b.AId, b.BId }) live.ToAccount(who, LiveKinds.CampaignUpdated, b.Id);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(me, bondId, ct);
    }

    /// Like BondService.Close (which this service cannot call without a cycle): closed, seats free, both told.
    private void Close(Bond b, BondState state, Guid? by, string? why)
    {
        b.State = state;
        b.ClosedAt = clock.UtcNow;
        b.ClosedBy = by;
        b.ClosedWhy = why;
        b.EmbersAt = null;
        foreach (var who in new[] { b.AId, b.BId })
        {
            live.ToAccount(who, LiveKinds.BondUpdated, b.Id);
            live.ToAccount(who, LiveKinds.SeekChanged, who);
        }
    }

    public async Task<Bond> LockLiveAsync(Guid me, Guid bondId, CancellationToken ct)
    {
        var b = await db.Set<Bond>().FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {bondId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        if (b.State != BondState.Live) throw new DomainException(409, "bond.closed", "The letters are closed");
        return b;
    }
}
