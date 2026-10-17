using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Bonds;

public sealed class BondService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score, PhotoService photos,
    Encounters.EncounterService encounters, Campaign.CampaignService campaign, Membership.MembershipService membership)
{
    /// Seats at a fire: base + the tier index + the floor's bonus. Losing a floor never breaks a bond;
    /// it only stops new ones until the fire is back under its seats.
    public int SeatsFor(string tier, Membership.FloorPerks perks) => config.Int(ConfigKeys.SeatsBase) + Tiers.Index(tier) + perks.SeatsBonus;

    public Task<int> LiveCountAsync(Guid accountId, CancellationToken ct = default) =>
        db.Set<Bond>().CountAsync(b => (b.AId == accountId || b.BId == accountId) && b.State == BondState.Live, ct);

    /// Serialises everything that takes or frees a seat for these people. Locks in id order so two
    /// summons between the same pair cannot deadlock.
    public async Task LockPeopleAsync(CancellationToken ct, params Guid[] ids)
    {
        foreach (var id in ids.Distinct().Order())
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({LockKey(id)})", ct);
    }

    /// Makes the bond. The caller (Seek) holds the transaction and both people's locks, and has
    /// checked candles and eligibility; the seats are checked here, under those locks.
    public async Task<Bond> CreateAsync(Guid summoner, Guid target, string summonerTier, string targetTier, CancellationToken ct = default)
    {
        if (await LiveCountAsync(summoner, ct) >= SeatsFor(summonerTier, await membership.PerksAsync(summoner, ct)))
            throw new DomainException(409, "seek.fire_full", "Your fire is full");
        if (await LiveCountAsync(target, ct) >= SeatsFor(targetTier, await membership.PerksAsync(target, ct)))
            throw new DomainException(409, "seek.their_fire_full", "Their fire is full tonight");
        return Make(summoner, target, summoner, BondOrigins.Seek);
    }

    /// A bond made for two people by someone else's hand (a Fated Thread's weaver, the Town Square):
    /// it spends no candle and may go past a full fire — the two exceptions to the seat limit.
    /// The caller has checked the pair may bond and holds the people's lock.
    public Bond Weave(Guid x, Guid y, Guid by, string origin) => Make(x, y, by, origin);

    private Bond Make(Guid x, Guid y, Guid summoner, string origin)
    {
        var (a, b) = Bond.Pair(x, y);
        var bond = new Bond
        {
            AId = a, BId = b, SummonerId = summoner, SummonDay = clock.TodayUb, State = BondState.Live, CreatedAt = clock.UtcNow,
            Origin = origin,
        };
        db.Add(bond);
        foreach (var who in new[] { x, y })
        {
            live.ToAccount(who, LiveKinds.BondCreated, bond.Id);
            live.ToAccount(who, LiveKinds.SeekChanged, who);
        }
        live.ToAdmins(LiveKinds.UserUpdated, x, y);
        return bond;
    }

    public async Task<IReadOnlyList<BondRow>> ListAsync(Guid me, CancellationToken ct = default)
    {
        var bonds = await db.Set<Bond>().AsNoTracking().Where(b => b.AId == me || b.BId == me)
            .OrderByDescending(b => b.LastLetterAt ?? b.CreatedAt).Take(200).ToListAsync(ct);
        if (bonds.Count == 0) return [];
        var others = bonds.Select(b => b.Other(me)).ToList();
        var names = await db.Set<Profile.Profile>().AsNoTracking().Where(p => others.Contains(p.AccountId))
            .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        var portraits = await photos.FirstPortraitsAsync(
            bonds.GroupBy(b => b.Other(me)).ToDictionary(g => g.Key, g => g.Max(b => b.Seals) >= 1), ct);

        return bonds.Select(b =>
        {
            var other = b.Other(me);
            var read = b.AId == me ? b.ReadA : b.ReadB;
            var unread = b.LastLetterBy is { } by && by != me && (read is null || read < b.LastLetterAt);
            return new BondRow(b.Id, b.State.ToString(), other, names.GetValueOrDefault(other, ""), portraits.GetValueOrDefault(other),
                b.Seals, b.LastLetterText, b.LastLetterBy == me, b.LastLetterAt, MyTurn(b, me), unread,
                b.State == BondState.Live && b.EmbersAt is not null, ColdAt(b), b.CreatedAt, b.ClosedAt);
        }).ToList();
    }

    /// Live bonds first, then the newest closed ones.
    public async Task<IReadOnlyList<AdminBondRow>> AdminListAsync(Guid accountId, CancellationToken ct = default)
    {
        var bonds = await db.Set<Bond>().AsNoTracking().Where(b => b.AId == accountId || b.BId == accountId)
            .OrderBy(b => b.State == BondState.Live ? 0 : 1).ThenByDescending(b => b.LastLetterAt ?? b.CreatedAt)
            .Take(50).ToListAsync(ct);
        var others = bonds.Select(b => b.Other(accountId)).ToList();
        var names = await db.Set<Profile.Profile>().AsNoTracking().Where(p => others.Contains(p.AccountId))
            .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        return bonds.Select(b =>
        {
            var mineA = b.AId == accountId;
            var other = b.Other(accountId);
            return new AdminBondRow(b.Id, b.State.ToString(), other, names.GetValueOrDefault(other, ""), b.Seals,
                mineA ? b.LettersA : b.LettersB, mineA ? b.LettersB : b.LettersA, b.LastLetterAt, b.CreatedAt, b.ClosedAt);
        }).ToList();
    }

    public async Task<BondView> GetAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await Find(me, bondId, tracked: false, ct);
        return await ViewAsync(b, me, ct);
    }

    public async Task<LetterPage> LettersAsync(Guid me, Guid bondId, DateTimeOffset? before, int limit, CancellationToken ct = default)
    {
        await Find(me, bondId, tracked: false, ct);
        limit = Math.Clamp(limit, 1, 100);
        var q = db.Set<Letter>().AsNoTracking().Where(l => l.BondId == bondId);
        if (before is { } at) q = q.Where(l => l.CreatedAt < at);
        var rows = await q.OrderByDescending(l => l.CreatedAt).ThenByDescending(l => l.Id).Take(limit + 1).ToListAsync(ct);
        var items = rows.Take(limit).Select(l => new LetterView(l.Id, l.AuthorId == me, l.Text, l.SealBroken, l.CreatedAt)).ToList();
        return new LetterPage(items, rows.Count > limit ? rows[limit - 1].CreatedAt : null);
    }

    public async Task<LetterView> WriteAsync(Guid me, Guid bondId, string text, CancellationToken ct = default)
    {
        text = text.Trim();
        if (text.Length == 0 || text.Any(c => char.IsControl(c) && c != '\n'))
            throw new DomainException(400, "letter.empty", "Write something first");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await db.Set<Bond>().FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {bondId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        if (b.State != BondState.Live) throw new DomainException(409, "bond.closed", "The letters are closed");

        var now = clock.UtcNow;
        var first = b.LettersA + b.LettersB == 0;
        var reply = b.LastLetterBy is { } lastBy && lastBy != me;
        if (b.AId == me) { b.LettersA++; b.ReadA = now; } else { b.LettersB++; b.ReadB = now; }
        b.LastLetterAt = now;
        b.LastLetterBy = me;
        b.LastLetterText = text.Length <= 140 ? text : text[..139] + "…";
        b.EmbersAt = null;

        var letter = new Letter { BondId = b.Id, AuthorId = me, Text = text, CreatedAt = now };
        var seals = SealsFor(b.Mutual);
        if (seals > b.Seals)
        {
            letter.SealBroken = seals;
            b.Seals = seals;
            await encounters.OnSealAsync(b, ct);
        }
        db.Add(letter);
        await db.SaveChangesAsync(ct);
        await campaign.SyncAsync(b, ct);

        if (first) await score.AwardAsync(me, DeedKinds.FirstLetter, config.Int(ConfigKeys.ScoreFirstLetter), b.Id, ct);
        else if (reply)
        {
            var today = clock.TodayUb;
            var paid = await db.Set<ScoreEvent>().CountAsync(e =>
                e.AccountId == me && e.BondId == b.Id && e.Day == today && e.Kind == DeedKinds.Reply, ct);
            if (paid < config.Int(ConfigKeys.ScoreReplyDailyCap))
                await score.AwardAsync(me, DeedKinds.Reply, config.Int(ConfigKeys.ScoreReply), b.Id, ct);
        }

        var other = b.Other(me);
        foreach (var who in new[] { me, other })
        {
            live.ToAccount(who, LiveKinds.LetterCreated, b.Id, letter.Id);
            live.ToAccount(who, LiveKinds.BondUpdated, b.Id);
        }
        var myName = await NameAsync(me, ct);
        push.Send(other, PushKinds.Letter, b.Id, myName, text);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new LetterView(letter.Id, true, letter.Text, letter.SealBroken, letter.CreatedAt);
    }

    public async Task ReadAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await Find(me, bondId, tracked: true, ct);
        if (b.AId == me) b.ReadA = clock.UtcNow; else b.ReadB = clock.UtcNow;
        live.ToAccount(me, LiveKinds.BondUpdated, b.Id);
        await db.SaveChangesAsync(ct);
    }

    public async Task SeverAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await db.Set<Bond>().FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {bondId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        if (b.State != BondState.Live) throw new DomainException(409, "bond.closed", "The letters are closed");
        Close(b, BondState.Severed, me);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// Cast out (or an account cast out by an admin): any live bond between them is severed by `by`.
    /// Runs in the caller's transaction; the caller saves.
    public async Task SeverBetweenAsync(Guid by, Guid other, CancellationToken ct = default)
    {
        var (a, b2) = Bond.Pair(by, other);
        var b = await db.Set<Bond>().FromSqlInterpolated(
                $"SELECT * FROM bonds WHERE \"AId\" = {a} AND \"BId\" = {b2} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (b is { State: BondState.Live }) Close(b, BondState.Severed, by);
    }

    public async Task SeverAllAsync(Guid accountId, CancellationToken ct = default)
    {
        var bonds = await db.Set<Bond>()
            .FromSqlInterpolated($"SELECT * FROM bonds WHERE (\"AId\" = {accountId} OR \"BId\" = {accountId}) AND \"State\" = 'Live' FOR UPDATE")
            .ToListAsync(ct);
        foreach (var b in bonds) Close(b, BondState.Severed, accountId);
    }

    /// Marks the bond closed and tells both sides; their seats free up.
    public void Close(Bond b, BondState state, Guid? by)
    {
        b.State = state;
        b.ClosedAt = clock.UtcNow;
        b.ClosedBy = by;
        b.EmbersAt = null;
        foreach (var who in new[] { b.AId, b.BId })
        {
            live.ToAccount(who, LiveKinds.BondUpdated, b.Id);
            live.ToAccount(who, LiveKinds.SeekChanged, who);
        }
    }

    public int SealsFor(int mutual) =>
        ConfigKeys.SealLadder.Count(k => mutual >= config.Int(k));

    /// Portraits a seal count reveals: one per seal up to three, all at four.
    public static int Revealed(int seals, int total) => seals >= 4 ? total : Math.Min(seals, total);

    private DateTimeOffset? ColdAt(Bond b) =>
        b.State == BondState.Live && b.LastLetterAt is { } at ? at.AddHours(config.Int(ConfigKeys.ColdHours)) : null;

    private static bool MyTurn(Bond b, Guid me) => b.State == BondState.Live && b.LastLetterBy is { } by && by != me;

    private async Task<Bond> Find(Guid me, Guid bondId, bool tracked, CancellationToken ct)
    {
        var q = tracked ? db.Set<Bond>() : db.Set<Bond>().AsNoTracking();
        var b = await q.SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        return b;
    }

    private async Task<BondView> ViewAsync(Bond b, Guid me, CancellationToken ct)
    {
        var otherId = b.Other(me);
        var p = await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(x => x.AccountId == otherId, ct);
        var total = await db.Set<Photo>().CountAsync(x => x.AccountId == otherId, ct);
        var portraits = await photos.PortraitsAsync(otherId, Revealed(b.Seals, total), ct);
        var person = new BondPersonView(otherId, p.Name, ProfileService.AgeOn(p.BirthDate, clock.TodayUb), p.Tier, p.Oath, p.Bio,
            Place(p.City, b.Seals >= 3), portraits,
            b.Seals >= 4 && (await membership.PerksAsync(me, ct)).Paid ? Profile.DeepProfile.Of(p) : null);
        var mine = b.AId == me ? b.LettersA : b.LettersB;
        var theirs = b.AId == me ? b.LettersB : b.LettersA;
        int? next = b.Seals < 4 ? config.Int(ConfigKeys.SealLadder[b.Seals]) : null;
        return new BondView(b.Id, b.State.ToString(), person, b.Seals, b.Mutual, next,
            ConfigKeys.SealLadder.Select(config.Int).ToList(), mine, theirs, MyTurn(b, me),
            b.State == BondState.Live && b.EmbersAt is not null, ColdAt(b), b.CreatedAt, b.ClosedAt, b.ClosedBy == me,
            b.SummonerId == me, b.ClosedWhy);
    }

    /// The district is a seal's reward; before it, the province (or the capital).
    public static string? Place(string? city, bool district)
    {
        if (city is null) return null;
        if (district) return city;
        return MongoliaGeo.All.FirstOrDefault(c => c.Name == city)?.Region ?? city;
    }

    private Task<string> NameAsync(Guid id, CancellationToken ct) =>
        db.Set<Profile.Profile>().Where(p => p.AccountId == id).Select(p => p.Name).SingleAsync(ct);

    private static long LockKey(Guid accountId) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("people:" + accountId)), 0);
}
