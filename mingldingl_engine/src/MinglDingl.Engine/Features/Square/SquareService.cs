using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Features.Video;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Square;

/// The Town Square. A gathering's night is arithmetic from its start: round i is live for
/// RoundMinutes, then the bell (decideSeconds to answer), then a short break before the next.
/// Phases are read from the clock; SquareClock makes the few writes at the boundaries (pairing at
/// each round's start, settling at each bell's end, the call a minute before).
public sealed class SquareService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score, BondService bonds,
    SeekService seek, AgoraSettings agora, Membership.MembershipService membership)
{
    /// The High Table's first seat at the bells: for a while after a bell is rung, only its members may sit.
    private DateTimeOffset SeatsOpenAt(Gathering g) => g.CreatedAt.AddMinutes(config.Int(ConfigKeys.SquareHighTableLeadMinutes));

    private TimeSpan Round(Gathering g) => TimeSpan.FromMinutes(g.RoundMinutes);
    private TimeSpan Decide => TimeSpan.FromSeconds(config.Int(ConfigKeys.SquareDecideSeconds));
    private TimeSpan Break => TimeSpan.FromSeconds(config.Int(ConfigKeys.SquareBreakSeconds));
    private TimeSpan Slot(Gathering g) => Round(g) + Decide + Break;
    public DateTimeOffset RoundStart(Gathering g, int i) => g.StartsAt + Slot(g) * i;
    public DateTimeOffset BellAt(Gathering g, int i) => RoundStart(g, i) + Round(g);
    public DateTimeOffset SettleAt(Gathering g, int i) => BellAt(g, i) + Decide;
    /// The last result stays on screen for one break before the square closes.
    public DateTimeOffset EndsAt(Gathering g) => SettleAt(g, g.Rounds - 1) + Break;

    private string StateOf(Gathering g, DateTimeOffset now) =>
        g.CancelledAt is not null ? "cancelled" : now < g.StartsAt ? "open" : now < EndsAt(g) ? "running" : "closed";

    // —— The tab ——

    public async Task<SquareView> GetAsync(Guid me, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.SquareEnabled)) return new SquareView(null);
        var now = clock.UtcNow;
        var soon = await db.Set<Gathering>().AsNoTracking().Where(g => g.CancelledAt == null && g.StartsAt > now.AddHours(-6))
            .OrderBy(g => g.StartsAt).Take(5).ToListAsync(ct);
        var next = soon.FirstOrDefault(g => EndsAt(g) > now);
        return new SquareView(next is null ? null : await ViewAsync(next, me, ct));
    }

    private async Task<GatheringView> ViewAsync(Gathering g, Guid me, CancellationToken ct)
    {
        var gender = await db.Set<Profile.Profile>().Where(p => p.AccountId == me).Select(p => p.Gender).SingleOrDefaultAsync(ct);
        var seats = await db.Set<Seat>().AsNoTracking().Where(s => s.GatheringId == g.Id).ToListAsync(ct);
        return new GatheringView(g.Id, g.Name, g.Festival, g.Masked, g.StartsAt, g.Rounds, g.RoundMinutes, g.Seats, seats.Count,
            g.Seats / 2, seats.Count(s => s.Gender == gender), seats.Any(s => s.AccountId == me), StateOf(g, clock.UtcNow), EndsAt(g),
            g.StartsAt - TimeSpan.FromMinutes(config.Int(ConfigKeys.SquareDoorsMinutes)), SeatsOpenAt(g));
    }

    public async Task<GatheringView> TakeSeatAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var g = await LockAsync(id, ct);
        if (StateOf(g, clock.UtcNow) != "open") throw new DomainException(409, "square.closed", "The bell has already rung");
        var p = await db.Set<Profile.Profile>().AsNoTracking().SingleOrDefaultAsync(x => x.AccountId == me, ct);
        var away = await db.Set<Account>().AnyAsync(a => a.Id == me && (a.DeleteAt != null || a.Status != AccountStatus.Active), ct);
        if (p is null || p.WelcomedAt is null || p.PausedAt is not null || p.RetiredAt is not null || away
            || p.Gender is not ("Male" or "Female"))
            throw new DomainException(409, "square.away", "Come back to Seek to take a seat");
        if (await db.Set<Seat>().AnyAsync(s => s.GatheringId == id && s.AccountId == me, ct)) return await ViewAsync(g, me, ct);
        if (clock.UtcNow < SeatsOpenAt(g) && await membership.FloorAsync(me, ct) != Membership.Floor.HighTable)
            throw new DomainException(409, "square.high_table_first", "The High Table sits first — seats open to all soon");
        if (await db.Set<Seat>().CountAsync(s => s.GatheringId == id && s.Gender == p.Gender, ct) >= g.Seats / 2)
            throw new DomainException(409, "square.full", "Your side of the square is full");
        db.Add(new Seat { GatheringId = id, AccountId = me, Gender = p.Gender, TakenAt = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        Announce(g);
        await tx.CommitAsync(ct);
        return await ViewAsync(g, me, ct);
    }

    public async Task<GatheringView> GiveUpSeatAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var g = await LockAsync(id, ct);
        if (StateOf(g, clock.UtcNow) == "open")
            await db.Set<Seat>().Where(s => s.GatheringId == id && s.AccountId == me).ExecuteDeleteAsync(ct);
        Announce(g);
        await tx.CommitAsync(ct);
        return await ViewAsync(g, me, ct);
    }

    // —— The night ——

    public async Task<NightView> JoinAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        var g = await FindAsync(id, ct);
        var now = clock.UtcNow;
        if (now < g.StartsAt - TimeSpan.FromMinutes(config.Int(ConfigKeys.SquareDoorsMinutes)))
            throw new DomainException(409, "square.not_yet", "The square opens a little before the first bell");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var n = await db.Set<Seat>().Where(s => s.GatheringId == id && s.AccountId == me && s.LeftAt == null)
            .ExecuteUpdateAsync(u => u.SetProperty(s => s.JoinedAt, s => s.JoinedAt ?? now), ct);
        if (n == 0) throw new DomainException(409, "square.no_seat", "There is no seat for you tonight");
        live.ToAdmins(LiveKinds.SquareUpdated, id);
        await tx.CommitAsync(ct);
        return await NightAsync(me, id, ct);
    }

    public async Task<NightView> LeaveAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Set<Seat>().Where(s => s.GatheringId == id && s.AccountId == me && s.LeftAt == null)
            .ExecuteUpdateAsync(u => u.SetProperty(s => s.LeftAt, now), ct);
        live.ToAccount(me, LiveKinds.SquareUpdated, id);
        await tx.CommitAsync(ct);
        return await NightAsync(me, id, ct);
    }

    public async Task<NightView> NightAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        var g = await FindAsync(id, ct);
        var now = clock.UtcNow;
        var seat = await db.Set<Seat>().AsNoTracking().SingleOrDefaultAsync(s => s.GatheringId == id && s.AccountId == me, ct);
        var bondsTonight = await db.Set<SquarePair>().CountAsync(p => p.GatheringId == id && p.Outcome == "match", ct);
        var locale = await QuestionsMn.LocaleAsync(db, me, ct);
        NightView View(string phase, int round, DateTimeOffset until, SquarePair? pair = null, NightCall? call = null,
            NightPartner? partner = null) =>
            new(g.Id, g.Name, g.Festival, g.Masked, phase, round, g.Rounds, until, partner, call, pair?.Question is { } q ? QuestionsMn.In(q, locale) : null,
                pair is null ? null : pair.ManId == me ? pair.ManYes : pair.WomanYes, pair?.Outcome, pair?.BondId, bondsTonight);

        if (seat is null) return View("notSeated", 0, EndsAt(g));
        if (seat.LeftAt is not null) return View("left", 0, EndsAt(g));
        if (now >= EndsAt(g) || g.CancelledAt is not null) return View("closed", g.Rounds, EndsAt(g));
        if (now < g.StartsAt) return View("filling", 0, g.StartsAt);

        var i = Math.Min(g.Rounds - 1, (int)((now - g.StartsAt) / Slot(g)));
        var pair = await db.Set<SquarePair>().AsNoTracking()
            .SingleOrDefaultAsync(p => p.GatheringId == id && p.Round == i && (p.ManId == me || p.WomanId == me), ct);
        var nextStart = i + 1 < g.Rounds ? RoundStart(g, i + 1) : EndsAt(g);
        if (pair is null) return View("filling", i + 1, now < RoundStart(g, i) ? RoundStart(g, i) : nextStart);

        var other = pair.Other(me);
        var op = await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(p => p.AccountId == other, ct);
        var uid = pair.ManId == me ? 1u : 2u;
        var partner = new NightPartner(other, op.Name, ProfileService.AgeOn(op.BirthDate, clock.TodayUb), uid == 1 ? 2u : 1u);
        if (now < BellAt(g, i))
        {
            var channel = "sq-" + pair.Id.ToString("N");
            var seconds = (uint)Math.Max(60, (BellAt(g, i) - now).TotalSeconds + 60);
            var call = agora.Ready
                ? new NightCall(agora.AppId!, channel, AgoraToken.BuildRtc(agora.AppId!, agora.AppCertificate!, channel, uid, seconds), uid)
                : null;
            return View("live", i + 1, BellAt(g, i), pair, call, partner);
        }
        var mine = pair.ManId == me ? pair.ManYes : pair.WomanYes;
        if (pair.Outcome is null && now < SettleAt(g, i))
            return View(mine is null ? "bell" : "decided", i + 1, SettleAt(g, i), pair, null, partner);
        return View("result", i + 1, nextStart, pair, null, partner);
    }

    public async Task<NightView> DecideAsync(Guid me, Guid id, bool yes, CancellationToken ct = default)
    {
        var g = await FindAsync(id, ct);
        var now = clock.UtcNow;
        var i = (int)((now - g.StartsAt) / Slot(g));
        if (now < g.StartsAt || i >= g.Rounds || now < BellAt(g, i) || now >= SettleAt(g, i))
            throw new DomainException(409, "square.no_bell", "The bell is not ringing");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var pair = await db.Set<SquarePair>().FromSqlInterpolated($"""
            SELECT * FROM square_pairs WHERE "GatheringId" = {id} AND "Round" = {i} AND ({me} IN ("ManId", "WomanId")) FOR UPDATE
            """).SingleOrDefaultAsync(ct) ?? throw new DomainException(409, "square.no_bell", "The bell is not ringing");
        if ((pair.ManId == me ? pair.ManYes : pair.WomanYes) is not null)
            throw new DomainException(409, "square.decided", "You have decided");
        if (pair.ManId == me) pair.ManYes = yes; else pair.WomanYes = yes;
        if (pair.ManYes is not null && pair.WomanYes is not null) await SettleAsync(g, pair, ct);
        await db.SaveChangesAsync(ct);
        foreach (var who in new[] { pair.ManId, pair.WomanId }) live.ToAccount(who, LiveKinds.SquareUpdated, id);
        await tx.CommitAsync(ct);
        return await NightAsync(me, id, ct);
    }

    /// Two yeses make a bond at once (no candle; it may go past a full fire — the square's exception);
    /// anything else parts them, and neither learns the other's choice. Either way both were there.
    private async Task SettleAsync(Gathering g, SquarePair pair, CancellationToken ct)
    {
        if (pair.Outcome is not null) return;
        pair.Outcome = "apart";
        if (pair.ManYes == true && pair.WomanYes == true)
        {
            await bonds.LockPeopleAsync(ct, pair.ManId, pair.WomanId);
            if (await seek.PairableAsync(pair.ManId, pair.WomanId, ct))
            {
                var bond = bonds.Weave(pair.ManId, pair.WomanId, g.Id, BondOrigins.Square);
                await db.SaveChangesAsync(ct);
                pair.BondId = bond.Id;
                pair.Outcome = "match";
                live.ToAdmins(LiveKinds.SquareUpdated, g.Id);
            }
        }
        foreach (var who in new[] { pair.ManId, pair.WomanId })
        {
            var paid = await db.Set<Seat>().Where(s => s.GatheringId == g.Id && s.AccountId == who && !s.AttendPaid)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.AttendPaid, true), ct);
            if (paid > 0) await score.AwardAsync(who, DeedKinds.Square, config.Int(ConfigKeys.ScoreSquare), null, ct);
        }
    }

    // —— The clock's writes ——

    /// Everything due now, for every gathering that is running or about to: the call a minute
    /// before, each round's pairing as it starts, each bell's settling as it ends. Idempotent.
    public async Task<int> TickAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var due = await db.Set<Gathering>().AsNoTracking()
            .Where(g => g.CancelledAt == null && g.StartsAt <= now.AddMinutes(1) && g.StartsAt > now.AddHours(-6))
            .Select(g => g.Id).ToListAsync(ct);
        var done = 0;
        foreach (var id in due)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var g = await db.Set<Gathering>().FromSqlInterpolated($"SELECT * FROM gatherings WHERE \"Id\" = {id} FOR UPDATE SKIP LOCKED")
                .SingleOrDefaultAsync(ct);
            if (g is null) continue;
            if (g.CalledAt is null && now < g.StartsAt)
            {
                g.CalledAt = now;
                foreach (var who in await db.Set<Seat>().Where(s => s.GatheringId == id).Select(s => s.AccountId).ToListAsync(ct))
                    push.Send(who, PushKinds.SquareSoon, null, g.Name);
                done++;
            }
            var rounds = await db.Set<SquareRound>().Where(r => r.GatheringId == id).ToListAsync(ct);
            for (var i = 0; i < g.Rounds && RoundStart(g, i) <= now; i++)
            {
                var r = rounds.FirstOrDefault(x => x.Index == i);
                if (r is null && now < BellAt(g, i))
                {
                    await PairAsync(g, i, ct);
                    db.Add(new SquareRound { GatheringId = id, Index = i, PairedAt = now });
                    Announce(g);
                    done++;
                }
                else if (r is null)
                    // A round the clock slept through: no one was paired for it.
                    db.Add(new SquareRound { GatheringId = id, Index = i, PairedAt = now, SettledAt = now });
                else if (r.SettledAt is null && now >= SettleAt(g, i))
                {
                    foreach (var pair in await db.Set<SquarePair>().Where(p => p.GatheringId == id && p.Round == i && p.Outcome == null).ToListAsync(ct))
                        await SettleAsync(g, pair, ct);
                    r.SettledAt = now;
                    Announce(g);
                    done++;
                }
                // The bell itself changes everyone's screen.
                if (r is not null && r.SettledAt is null && now >= BellAt(g, i) && now < BellAt(g, i) + TimeSpan.FromSeconds(3))
                    Announce(g);
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        return done;
    }

    /// The present (joined, not left), a man and a woman a table, never two who are bonded, cast out
    /// or already met tonight; the same oath first. Whoever is left over sits the round out.
    private async Task PairAsync(Gathering g, int round, CancellationToken ct)
    {
        var present = await (from s in db.Set<Seat>()
                             join p in db.Set<Profile.Profile>() on s.AccountId equals p.AccountId
                             where s.GatheringId == g.Id && s.JoinedAt != null && s.LeftAt == null
                             select new { s.AccountId, s.Gender, p.Oath }).ToListAsync(ct);
        var met = (await db.Set<SquarePair>().Where(p => p.GatheringId == g.Id).Select(p => new { p.ManId, p.WomanId }).ToListAsync(ct))
            .Select(p => (p.ManId, p.WomanId)).ToHashSet();
        var questions = await db.Set<IcebreakerQuestion>().Select(q => q.Text).ToListAsync(ct);
        var rng = new Random(HashCode.Combine(g.Id, round));
        var women = present.Where(p => p.Gender == "Female").OrderBy(_ => rng.Next()).ToList();
        foreach (var man in present.Where(p => p.Gender == "Male").OrderBy(_ => rng.Next()))
        {
            var pick = women.Where(w => !met.Contains((man.AccountId, w.AccountId)))
                .OrderByDescending(w => w.Oath == man.Oath).ToList();
            foreach (var w in pick)
            {
                if (!await seek.PairableAsync(man.AccountId, w.AccountId, ct)) continue;
                db.Add(new SquarePair
                {
                    Id = Guid.CreateVersion7(), GatheringId = g.Id, Round = round, ManId = man.AccountId, WomanId = w.AccountId,
                    Question = questions.Count > 0 ? questions[rng.Next(questions.Count)] : "",
                });
                women.Remove(w);
                break;
            }
        }
    }

    // —— Keepers ——

    public async Task<IReadOnlyList<AdminGatheringRow>> AdminListAsync(CancellationToken ct = default)
    {
        var rows = await db.Set<Gathering>().AsNoTracking().OrderByDescending(g => g.StartsAt).Take(100).ToListAsync(ct);
        var ids = rows.Select(r => r.Id).ToList();
        var taken = await db.Set<Seat>().Where(s => ids.Contains(s.GatheringId)).GroupBy(s => s.GatheringId)
            .Select(x => new { x.Key, N = x.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var made = await db.Set<SquarePair>().Where(p => ids.Contains(p.GatheringId) && p.Outcome == "match").GroupBy(p => p.GatheringId)
            .Select(x => new { x.Key, N = x.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var now = clock.UtcNow;
        return rows.Select(g => new AdminGatheringRow(g.Id, g.Name, g.StartsAt, taken.GetValueOrDefault(g.Id), g.Seats, g.Rounds,
            g.RoundMinutes, StateOf(g, now), made.GetValueOrDefault(g.Id), g.Festival, g.Masked)).ToList();
    }

    public async Task<AdminGatheringRow> RingAsync(GatheringWriteRequest req, CancellationToken ct = default)
    {
        if (req.StartsAt <= clock.UtcNow) throw new DomainException(400, "square.past", "Ring the bell for a time still ahead");
        var g = new Gathering
        {
            Id = Guid.CreateVersion7(), Name = req.Name.Trim(), StartsAt = req.StartsAt, Rounds = req.Rounds,
            RoundMinutes = req.RoundMinutes, Seats = req.Seats - req.Seats % 2, Festival = req.Festival, Masked = req.Masked,
            CreatedAt = clock.UtcNow,
        };
        db.Add(g);
        live.ToAll(LiveKinds.SquareUpdated);
        live.ToAdmins(LiveKinds.SquareUpdated, g.Id);
        await db.SaveChangesAsync(ct);
        return (await AdminListAsync(ct)).Single(r => r.Id == g.Id);
    }

    /// Changes a gathering not yet begun; seats already taken keep their place.
    public async Task<AdminGatheringRow> EditAsync(Guid id, GatheringWriteRequest req, CancellationToken ct = default)
    {
        var g = await db.Set<Gathering>().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException(404, "square.not_found", "No such gathering");
        if (g.CancelledAt is not null || g.StartsAt <= clock.UtcNow)
            throw new DomainException(409, "square.started", "A gathering that began or was cancelled cannot change");
        if (req.StartsAt <= clock.UtcNow) throw new DomainException(400, "square.past", "Ring the bell for a time still ahead");
        var seats = req.Seats - req.Seats % 2;
        if (await db.Set<Seat>().CountAsync(s => s.GatheringId == id, ct) > seats)
            throw new DomainException(409, "square.seats_taken", "More seats are taken than that");
        (g.Name, g.StartsAt, g.Rounds, g.RoundMinutes, g.Seats, g.Festival, g.Masked) =
            (req.Name.Trim(), req.StartsAt, req.Rounds, req.RoundMinutes, seats, req.Festival, req.Masked);
        live.ToAll(LiveKinds.SquareUpdated);
        live.ToAdmins(LiveKinds.SquareUpdated, g.Id);
        await db.SaveChangesAsync(ct);
        return (await AdminListAsync(ct)).Single(r => r.Id == g.Id);
    }

    public async Task CancelAsync(Guid id, CancellationToken ct = default)
    {
        var g = await db.Set<Gathering>().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException(404, "square.not_found", "No such gathering");
        g.CancelledAt ??= clock.UtcNow;
        live.ToAll(LiveKinds.SquareUpdated);
        live.ToAdmins(LiveKinds.SquareUpdated, g.Id);
        await db.SaveChangesAsync(ct);
    }

    // —— helpers ——

    private void Announce(Gathering g)
    {
        live.ToAll(LiveKinds.SquareUpdated);
        live.ToAdmins(LiveKinds.SquareUpdated, g.Id);
    }

    private async Task<Gathering> FindAsync(Guid id, CancellationToken ct) =>
        await db.Set<Gathering>().AsNoTracking().SingleOrDefaultAsync(g => g.Id == id, ct)
        ?? throw new DomainException(404, "square.not_found", "No such gathering");

    private async Task<Gathering> LockAsync(Guid id, CancellationToken ct) =>
        await db.Set<Gathering>().FromSqlInterpolated($"SELECT * FROM gatherings WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct)
        ?? throw new DomainException(404, "square.not_found", "No such gathering");
}
