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

namespace MinglDingl.Engine.Features.Video;

/// Agora's keys. devPresence: the apps may report join/leave themselves (Development only — there
/// is no public URL for Agora's webhook there).
public sealed record AgoraSettings(string? AppId, string? AppCertificate, string? NcsSecret, bool DevPresence)
{
    public bool Ready => !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(AppCertificate);
}

/// What the app needs to step into the call.
public sealed record CallTicket(Guid CallId, string AppId, string Channel, string Token, uint Uid, DateTimeOffset IssuedAt, int Minutes);

public sealed record PresenceRequest(bool Joined);

/// The Flame Rite: proposing, answering, and the calls themselves. Whether a call counted is
/// decided here from presence (Agora's webhook, or in Development the apps' own reports), never
/// from an app saying "done".
public sealed class VideoService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score,
    EncounterService encounters, AgoraSettings agora)
{
    public const int GraceMinutes = 2;

    public async Task<EncounterView> ProposeAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        Enabled();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        if (e?.IcebreakerRevealedAt is null) throw new DomainException(409, "rite.closed", "Break the ice first");
        if (e.RiteDoneAt is not null) throw new DomainException(409, "rite.done", "The Rite is already done");
        if (e.RiteAcceptedAt is not null) throw new DomainException(409, "rite.accepted", "The Rite is already agreed");
        if (e.RiteBy is not null && e.RiteDeclinedAt is null) throw new DomainException(409, "rite.proposed", "The Rite is already asked for");
        if (e.RiteBy == me && e.RiteDeclinedAt is { } no && clock.UtcNow < no.AddHours(config.Int(ConfigKeys.VideoReproposeHours)))
            throw new DomainException(409, "rite.wait", "Give them time before you ask again");
        e.RiteBy = me;
        e.RiteAt = clock.UtcNow;
        e.RiteDeclinedAt = null;
        encounters.Announce(b);
        push.Send(b.Other(me), PushKinds.RiteProposed, b.Id, await NameAsync(me, ct));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    public async Task<EncounterView> AnswerAsync(Guid me, Guid bondId, bool accept, CancellationToken ct = default)
    {
        Enabled();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        if (e?.RiteBy is not { } by || e.RiteAcceptedAt is not null || e.RiteDeclinedAt is not null || e.RiteDoneAt is not null)
            throw new DomainException(409, "rite.not_asked", "No one has asked for the Rite");
        if (by == me) throw new DomainException(409, "rite.own", "They must answer your call");
        if (accept) e.RiteAcceptedAt = clock.UtcNow; else e.RiteDeclinedAt = clock.UtcNow;
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// Steps into the Rite: the running attempt if there is one, otherwise a new channel.
    public async Task<CallTicket> StartAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        Enabled();
        if (!agora.Ready) throw new DomainException(503, "video.unavailable", "The Rite cannot be lit right now");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        if (e?.RiteAcceptedAt is null) throw new DomainException(409, "rite.not_agreed", "Both must agree to the Rite first");
        if (e.RiteDoneAt is not null) throw new DomainException(409, "rite.done", "The Rite is already done");
        var now = clock.UtcNow;
        var call = await db.Set<Call>().Where(c => c.BondId == b.Id && c.EndedAt == null)
            .OrderByDescending(c => c.IssuedAt).FirstOrDefaultAsync(ct);
        if (call is not null && now > Deadline(call))
        {
            // Its time ran out with no one saying so (an app closed at 0:00): what they shared counts.
            End(call, now);
            await db.SaveChangesAsync(ct);
            await SettleAsync(b, e, call, ct);
            call = null;
            if (e.RiteDoneAt is not null)
            {
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                throw new DomainException(409, "rite.done", "The Rite is already done");
            }
        }
        if (call is null)
        {
            call = new Call { BondId = b.Id, Channel = "rite-" + Guid.NewGuid().ToString("N"), IssuedAt = now };
            db.Add(call);
            live.ToAccount(b.AId, LiveKinds.VideoCall, b.Id);
            live.ToAccount(b.BId, LiveKinds.VideoCall, b.Id);
            encounters.Announce(b);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var uid = b.AId == me ? 1u : 2u;
        var seconds = (uint)(Deadline(call) - now).TotalSeconds;
        var token = AgoraToken.BuildRtc(agora.AppId!, agora.AppCertificate!, call.Channel, uid, Math.Max(seconds, 60));
        return new CallTicket(call.Id, agora.AppId!, call.Channel, token, uid, call.IssuedAt, config.Int(ConfigKeys.VideoMinutes));
    }

    /// Douse the fire: the attempt ends for both. What they shared until now still counts.
    public async Task<EncounterView> DouseAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        var call = await OpenCallAsync(b.Id, ct);
        if (call is not null)
        {
            End(call, clock.UtcNow);
            await db.SaveChangesAsync(ct);
            await SettleAsync(b, e!, call, ct);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// Someone stepped in or out of a call's channel at `at` (uid 1 = the bond's A, 2 = B).
    public async Task PresenceAsync(string channel, uint uid, bool joined, DateTimeOffset at, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var call = await db.Set<Call>().FromSqlInterpolated($"SELECT * FROM calls WHERE \"Channel\" = {channel} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (call is null || call.EndedAt is not null || uid is not (1 or 2)) return;
        at = at > Deadline(call) ? Deadline(call) : at;
        if (call.AIn is not null && call.BIn is not null && !joined) call.TogetherSeconds += Overlap(call, at);
        // A join while already in (an app that crashed and came back) keeps the earlier time.
        if (uid == 1) call.AIn = joined ? call.AIn ?? at : null; else call.BIn = joined ? call.BIn ?? at : null;
        if (call.AIn is not null && call.BIn is not null) call.BothAt ??= at;
        var b = await db.Set<Bond>().SingleAsync(x => x.Id == call.BondId, ct);
        var e = await db.Set<Encounter>().FromSqlInterpolated($"SELECT * FROM encounters WHERE \"BondId\" = {b.Id} FOR UPDATE")
            .SingleAsync(ct);
        await db.SaveChangesAsync(ct);
        await SettleAsync(b, e, call, ct);
        live.ToAccount(b.AId, LiveKinds.VideoCall, b.Id);
        live.ToAccount(b.BId, LiveKinds.VideoCall, b.Id);
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// The app's own report of joining or leaving (Development only).
    public async Task DevPresenceAsync(Guid me, Guid callId, bool joined, CancellationToken ct = default)
    {
        if (!agora.DevPresence) throw new DomainException(404, "not_found", "Not found");
        var call = await db.Set<Call>().AsNoTracking().SingleOrDefaultAsync(c => c.Id == callId, ct)
            ?? throw new DomainException(404, "call.not_found", "That call does not exist");
        var b = await db.Set<Bond>().AsNoTracking().SingleAsync(x => x.Id == call.BondId, ct);
        if (!b.Has(me)) throw new DomainException(404, "call.not_found", "That call does not exist");
        // A leave may arrive a moment after 0:00 (it is counted up to the end); a join may not.
        if (joined && clock.UtcNow > Deadline(call)) throw new DomainException(409, "call.over", "That call is over");
        await PresenceAsync(call.Channel, b.AId == me ? 1u : 2u, joined, clock.UtcNow, ct);
    }

    /// Attempts whose time ran out with no one ending them (an app closed mid-call): ended, and
    /// counted for whatever the pair shared.
    public async Task<List<Guid>> StaleAsync(CancellationToken ct = default)
    {
        var before = clock.UtcNow.AddMinutes(-(config.Int(ConfigKeys.VideoMinutes) + GraceMinutes));
        return await db.Set<Call>().AsNoTracking().Where(c => c.EndedAt == null && (c.BothAt ?? c.IssuedAt) < before)
            .Select(c => c.Id).Take(200).ToListAsync(ct);
    }

    public async Task EndStaleAsync(Guid callId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var call = await db.Set<Call>().FromSqlInterpolated($"SELECT * FROM calls WHERE \"Id\" = {callId} FOR UPDATE SKIP LOCKED")
            .SingleOrDefaultAsync(ct);
        if (call is null || call.EndedAt is not null || clock.UtcNow <= Deadline(call)) return;
        End(call, Deadline(call));
        var b = await db.Set<Bond>().SingleAsync(x => x.Id == call.BondId, ct);
        var e = await db.Set<Encounter>().SingleAsync(x => x.BondId == b.Id, ct);
        await db.SaveChangesAsync(ct);
        await SettleAsync(b, e, call, ct);
        live.ToAccount(b.AId, LiveKinds.VideoCall, b.Id);
        live.ToAccount(b.BId, LiveKinds.VideoCall, b.Id);
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// Counts what the pair shared and, at the threshold, completes the Rite (+points once).
    private async Task SettleAsync(Bond b, Encounter e, Call call, CancellationToken ct)
    {
        var together = call.TogetherSeconds;
        if (call.EndedAt is null && call.AIn is not null && call.BIn is not null)
            together += Overlap(call, Min(clock.UtcNow, Deadline(call)));
        if (call.Completed || e.RiteDoneAt is not null || together < config.Int(ConfigKeys.VideoMinSeconds)) return;
        call.Completed = true;
        e.RiteDoneAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        foreach (var who in new[] { b.AId, b.BId })
            await score.AwardAsync(who, DeedKinds.Rite, config.Int(ConfigKeys.ScoreRite), b.Id, ct);
        await encounters.ClearChambersAsync(b, ct);
        encounters.Announce(b);
    }

    private void End(Call call, DateTimeOffset at)
    {
        at = Min(at, Deadline(call));
        if (call.AIn is not null && call.BIn is not null) call.TogetherSeconds += Overlap(call, at);
        call.AIn = call.BIn = null;
        call.EndedAt = at;
    }

    private Task<Call?> OpenCallAsync(Guid bondId, CancellationToken ct) =>
        db.Set<Call>().Where(c => c.BondId == bondId && c.EndedAt == null).OrderByDescending(c => c.IssuedAt).FirstOrDefaultAsync(ct);

    /// The five minutes run from when both were in; until then the attempt waits a few minutes.
    private DateTimeOffset Deadline(Call c) =>
        (c.BothAt ?? c.IssuedAt).AddMinutes(config.Int(ConfigKeys.VideoMinutes) + (c.BothAt is null ? GraceMinutes : 0));

    private static int Overlap(Call c, DateTimeOffset until)
    {
        var from = c.AIn > c.BIn ? c.AIn!.Value : c.BIn!.Value;
        return Math.Max(0, (int)(until - from).TotalSeconds);
    }

    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;

    private void Enabled()
    {
        if (!config.Bool(ConfigKeys.VideoEnabled)) throw new DomainException(404, "video.off", "The Flame Rite is not offered");
    }

    private Task<string> NameAsync(Guid id, CancellationToken ct) =>
        db.Set<Profile.Profile>().Where(p => p.AccountId == id).Select(p => p.Name).SingleAsync(ct);
}
