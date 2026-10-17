using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Threads;

/// Fated Threads and allies. A thread is double-blind: each side answers without learning who the
/// other is; two yeses (and a pair Seek would allow) make a bond, and the weaver earns its due.
public sealed class ThreadService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score, BondService bonds,
    SeekService seek)
{
    public async Task<WovenView> WeaveAsync(Guid me, WeaveRequest req, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.ThreadsEnabled)) throw new DomainException(409, "threads.closed", "Threads cannot be woven now");
        var (first, second) = (req.First.Trim(), req.Second.Trim());
        if (!PhoneVerificationService.IsPhoneValid(first) || !PhoneVerificationService.IsPhoneValid(second))
            throw new DomainException(400, "auth.bad_phone", "Enter an 8-digit Mongolian number");
        var mine = await db.Set<Account>().Where(a => a.Id == me).Select(a => a.Phone).SingleAsync(ct);
        if (first == second) throw new DomainException(400, "threads.same", "Two different people, please");
        if (first == mine || second == mine) throw new DomainException(400, "threads.self", "A thread is for two other people");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await bonds.LockPeopleAsync(ct, me);
        var since = UbDays.Start(clock.TodayUb);
        if (await db.Set<FatedThread>().CountAsync(t => t.WeaverId == me && t.WovenAt >= since, ct) >= config.Int(ConfigKeys.ThreadsPerDay))
            throw new DomainException(409, "threads.limit", "Two threads a day — weave again tomorrow");
        var t = new FatedThread
        {
            Id = Guid.CreateVersion7(), WeaverId = me, PhoneA = first, PhoneB = second, CodeA = Code(), CodeB = Code(),
            State = ThreadState.Waiting, WovenAt = clock.UtcNow,
        };
        db.Add(t);
        await db.SaveChangesAsync(ct);
        var weaver = await NameAsync(me, ct);
        foreach (var held in await HoldersAsync(t, ct))
        {
            live.ToAccount(held, LiveKinds.ThreadUpdated, t.Id);
            push.Send(held, PushKinds.ThreadWoven, null, weaver);
        }
        live.ToAccount(me, LiveKinds.ThreadUpdated, t.Id);
        live.ToAdmins(LiveKinds.ThreadUpdated, t.Id);
        await tx.CommitAsync(ct);
        return new WovenView(t.Id, t.CodeA, t.CodeB);
    }

    /// The weaver's Thread Log, newest first.
    public async Task<IReadOnlyList<WovenRow>> WovenAsync(Guid me, CancellationToken ct = default)
    {
        var rows = await db.Set<FatedThread>().AsNoTracking().Where(t => t.WeaverId == me)
            .OrderByDescending(t => t.WovenAt).Take(100).ToListAsync(ct);
        var names = await NamesByPhoneAsync(rows.Select(r => r.PhoneA), ct);
        var points = config.Int(ConfigKeys.ScoreThreadSparked);
        return rows.Select(r => new WovenRow(r.Id, names.GetValueOrDefault(r.PhoneA) ?? Mask(r.PhoneA), StateOf(r), r.WovenAt,
            r.State == ThreadState.Sparked ? points : 0)).ToList();
    }

    /// Threads woven for me (by my number), still waiting or recently settled.
    public async Task<IReadOnlyList<InvitationView>> InvitationsAsync(Guid me, CancellationToken ct = default)
    {
        var phone = await db.Set<Account>().Where(a => a.Id == me).Select(a => a.Phone).SingleAsync(ct);
        var rows = await db.Set<FatedThread>().AsNoTracking().Where(t => t.PhoneA == phone || t.PhoneB == phone)
            .OrderByDescending(t => t.WovenAt).Take(50).ToListAsync(ct);
        var weavers = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => rows.Select(r => r.WeaverId).Contains(p.AccountId)).ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        return rows.Where(r => StateOf(r) is "waiting" or "oneSaidYes")
            .Select(r => new InvitationView(r.Id, weavers.GetValueOrDefault(r.WeaverId, ""),
                r.PhoneA == phone ? r.AnswerA : r.AnswerB, StateOf(r), r.WovenAt)).ToList();
    }

    public async Task<InvitationView> AnswerAsync(Guid me, Guid id, bool yes, CancellationToken ct = default)
    {
        var phone = await db.Set<Account>().Where(a => a.Id == me).Select(a => a.Phone).SingleAsync(ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var t = await db.Set<FatedThread>().FromSqlInterpolated($"SELECT * FROM threads WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (t is null || (t.PhoneA != phone && t.PhoneB != phone))
            throw new DomainException(404, "threads.not_found", "That thread is not yours to answer");
        if (StateOf(t) is "sparked" or "cut") throw new DomainException(409, "threads.closed", "That thread is already tied or cut");
        var isA = t.PhoneA == phone;
        if ((isA ? t.AnswerA : t.AnswerB) is not null) throw new DomainException(409, "threads.answered", "You have answered");
        if (isA) t.AnswerA = yes; else t.AnswerB = yes;

        var now = clock.UtcNow;
        if (!yes) Cut(t, now);
        else if (t.AnswerA == true && t.AnswerB == true)
        {
            var other = await db.Set<Account>().Where(a => a.Phone == (isA ? t.PhoneB : t.PhoneA)).Select(a => (Guid?)a.Id)
                .SingleOrDefaultAsync(ct);
            if (other is { } o)
            {
                await bonds.LockPeopleAsync(ct, me, o);
                if (await seek.PairableAsync(me, o, ct))
                {
                    var bond = bonds.Weave(me, o, t.WeaverId, BondOrigins.Thread);
                    await db.SaveChangesAsync(ct);
                    t.State = ThreadState.Sparked;
                    t.BondId = bond.Id;
                    t.ClosedAt = now;
                    await score.AwardAsync(t.WeaverId, DeedKinds.ThreadSparked, config.Int(ConfigKeys.ScoreThreadSparked), null, ct);
                    var weaver = await NameAsync(t.WeaverId, ct);
                    push.Send(me, PushKinds.BondMade, bond.Id, weaver);
                    push.Send(o, PushKinds.BondMade, bond.Id, weaver);
                    push.Send(t.WeaverId, PushKinds.ThreadSparked, null, null);
                }
                else Cut(t, now);
            }
            else Cut(t, now);
        }
        await db.SaveChangesAsync(ct);
        foreach (var held in await HoldersAsync(t, ct)) live.ToAccount(held, LiveKinds.ThreadUpdated, t.Id);
        live.ToAccount(t.WeaverId, LiveKinds.ThreadUpdated, t.Id);
        live.ToAdmins(LiveKinds.ThreadUpdated, t.Id);
        await tx.CommitAsync(ct);
        var weaverName = await NameAsync(t.WeaverId, ct);
        return new InvitationView(t.Id, weaverName, yes, StateOf(t), t.WovenAt);
    }

    public async Task<IReadOnlyList<AdminThreadRow>> AdminListAsync(CancellationToken ct = default)
    {
        var rows = await db.Set<FatedThread>().AsNoTracking().OrderByDescending(t => t.WovenAt).Take(200).ToListAsync(ct);
        var weavers = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => rows.Select(r => r.WeaverId).Contains(p.AccountId)).ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        var known = (await db.Set<Account>().AsNoTracking()
            .Where(a => rows.Select(r => r.PhoneA).Contains(a.Phone) || rows.Select(r => r.PhoneB).Contains(a.Phone))
            .Select(a => a.Phone).ToListAsync(ct)).ToHashSet();
        string Shown(string phone) => known.Contains(phone) ? Mask(phone) : "new number";
        return rows.Select(r => new AdminThreadRow(r.Id, weavers.GetValueOrDefault(r.WeaverId, ""), Shown(r.PhoneA), Shown(r.PhoneB),
            r.WovenAt, StateOf(r))).ToList();
    }

    // —— Allies ——

    public async Task<AllyView> AllyAsync(Guid me, CancellationToken ct = default)
    {
        var a = await db.Set<Account>().SingleAsync(x => x.Id == me, ct);
        if (a.AllyCode is null)
        {
            for (var tries = 0; a.AllyCode is null; tries++)
            {
                var code = AllyCode();
                if (!await db.Set<Account>().AnyAsync(x => x.AllyCode == code, ct)) a.AllyCode = code;
                if (tries > 20) throw new InvalidOperationException("No free ally code");
            }
            await db.SaveChangesAsync(ct);
        }
        var answered = await db.Set<Account>().CountAsync(x => x.CalledBy == me
            && db.Set<Profile.Profile>().Any(p => p.AccountId == x.Id && p.WelcomedAt != null), ct);
        return new AllyView(a.AllyCode!, answered, config.Int(ConfigKeys.AllyBounty));
    }

    // —— helpers ——

    /// A thread with no second answer past its days is cut, as if read at that moment.
    private string StateOf(FatedThread t) => t.State switch
    {
        ThreadState.Sparked => "sparked",
        ThreadState.Cut => "cut",
        _ when t.WovenAt.AddDays(config.Int(ConfigKeys.ThreadsExpireDays)) <= clock.UtcNow => "cut",
        _ => t.AnswerA == true || t.AnswerB == true ? "oneSaidYes" : "waiting",
    };

    private static void Cut(FatedThread t, DateTimeOffset now)
    {
        t.State = ThreadState.Cut;
        t.ClosedAt = now;
    }

    private Task<List<Guid>> HoldersAsync(FatedThread t, CancellationToken ct) =>
        db.Set<Account>().Where(a => a.Phone == t.PhoneA || a.Phone == t.PhoneB).Select(a => a.Id).ToListAsync(ct);

    private Task<string> NameAsync(Guid id, CancellationToken ct) =>
        db.Set<Profile.Profile>().Where(p => p.AccountId == id).Select(p => p.Name).SingleOrDefaultAsync(ct)!;

    private async Task<Dictionary<string, string>> NamesByPhoneAsync(IEnumerable<string> phones, CancellationToken ct)
    {
        var list = phones.Distinct().ToList();
        return await (from a in db.Set<Account>().AsNoTracking()
                      join p in db.Set<Profile.Profile>() on a.Id equals p.AccountId
                      where list.Contains(a.Phone)
                      select new { a.Phone, p.Name }).ToDictionaryAsync(x => x.Phone, x => x.Name, ct);
    }

    /// "9911····": enough for the weaver to recognise their own entry, never the whole number.
    private static string Mask(string phone) => phone.Length >= 4 ? phone[..4] + "····" : "····";

    private const string Letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";

    private static string Code() =>
        new(Enumerable.Range(0, 6).Select(_ => Letters[RandomNumberGenerator.GetInt32(Letters.Length)]).ToArray());

    private static string AllyCode() =>
        new string(Enumerable.Range(0, 4).Select(_ => Letters[RandomNumberGenerator.GetInt32(Letters.Length)]).ToArray())
        + "-" + RandomNumberGenerator.GetInt32(1000, 10000);
}
