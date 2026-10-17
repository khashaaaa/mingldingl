using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Seek;

public sealed class SeekService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, BondService bonds, PhotoService photos,
    Membership.MembershipService membership)
{
    private static readonly TimeZoneInfo Ub = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ulaanbaatar");

    public static int CandlesPerDay(Profile.Profile p, Membership.FloorPerks perks, IConfig config) =>
        Tiers.Candles(p.Points, Tiers.Index(p.Tier), config, perks.CandlesBase, perks.CandlesCap);

    public async Task<SeekView> GetAsync(Guid me, CancellationToken ct = default)
    {
        var p = await Me(me, ct);
        var floor = await membership.FloorAsync(me, ct);
        var perks = membership.Perks(floor);
        var perDay = CandlesPerDay(p, perks, config);
        var left = Math.Max(0, perDay - await UsedTodayAsync(me, ct));
        var seats = bonds.SeatsFor(p.Tier, perks);
        var used = await bonds.LiveCountAsync(me, ct);
        var dawn = NextDawn();
        var filter = perks.Paid ? await db.Set<SeekFilter>().AsNoTracking().SingleOrDefaultAsync(f => f.AccountId == me, ct) : null;
        var today = clock.TodayUb;
        var look = perks.Paid ? await db.Set<SecondLook>().AsNoTracking().SingleOrDefaultAsync(l => l.AccountId == me && l.Day == today, ct) : null;
        string? lookName = null;
        if (perks.Paid && look is null && await LastPassAsync(me, ct) is { } last)
            lookName = await db.Set<Profile.Profile>().Where(x => x.AccountId == last).Select(x => x.Name).SingleOrDefaultAsync(ct);
        SeekView View(string state, CandidateView? c, int l) =>
            new(state, c, l, perDay, dawn, used, seats, Membership.Floors.Key(floor), lookName, filter is not null && Active(filter));

        if (!config.Bool(ConfigKeys.SeekEnabled)) return View("closed", null, left);
        if (used >= seats) return View("full", null, left);
        if (left == 0) return View("rests", null, 0);
        // Tonight's second look comes first while they are still to be found.
        if (look is not null && (await CandidatesAsync(p, look.TargetId, null, ct)).Count > 0)
            return View("companion", await CandidateAsync(look.TargetId, ct), left);
        var id = (await CandidatesAsync(p, null, filter, ct)).FirstOrDefault();
        if (id == Guid.Empty) return View("empty", null, left);
        return View("companion", await CandidateAsync(id, ct), left);
    }

    /// A member brings back the last person passed tonight, once a night.
    public async Task<SeekView> SecondLookAsync(Guid me, CancellationToken ct = default)
    {
        if (!(await membership.PerksAsync(me, ct)).Paid)
            throw new DomainException(403, "membership.hall", "A second look is the Hall's");
        var today = clock.TodayUb;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (await db.Set<SecondLook>().AnyAsync(l => l.AccountId == me && l.Day == today, ct))
            throw new DomainException(409, "seek.second_look_used", "One second look a night");
        var last = await LastPassAsync(me, ct) ?? throw new DomainException(409, "seek.no_pass", "You have passed no one tonight");
        await db.Set<SeekPass>().Where(x => x.AccountId == me && x.Day == today && x.TargetId == last).ExecuteDeleteAsync(ct);
        db.Add(new SecondLook { AccountId = me, Day = today, TargetId = last });
        live.ToAccount(me, LiveKinds.SeekChanged, me);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(me, ct);
    }

    public async Task<SeekFilterView> FiltersAsync(Guid me, CancellationToken ct = default)
    {
        var open = (await membership.PerksAsync(me, ct)).Paid;
        var f = await db.Set<SeekFilter>().AsNoTracking().SingleOrDefaultAsync(x => x.AccountId == me, ct);
        return new SeekFilterView(open, f?.AgeMin, f?.AgeMax, f?.City, f?.Oath, f?.Children, f?.Smoking, f?.Drinking);
    }

    /// Replaces the filters (all nulls clears them). Members only.
    public async Task<SeekFilterView> SetFiltersAsync(Guid me, SeekFilterRequest req, CancellationToken ct = default)
    {
        if (!(await membership.PerksAsync(me, ct)).Paid)
            throw new DomainException(403, "membership.hall", "Filters are the Hall's");
        if (req.AgeMin is { } lo && req.AgeMax is { } hi && lo > hi)
            throw new DomainException(400, "seek.filter_age", "The youngest age must not be above the oldest");
        if (req.City is { } city && MongoliaGeo.All.All(c => c.Name != city))
            throw new DomainException(400, "seek.filter_city", "Choose a district from the list");
        if (req.Oath is { } oath && oath is not ("Bond" or "Fate" or "Kinship"))
            throw new DomainException(400, "seek.filter_oath", "Bond, Fate or Kinship");
        foreach (var (field, value) in new[] { ("children", req.Children), ("smoking", req.Smoking), ("drinking", req.Drinking) })
            if (value is not null && !Profile.DeepProfile.Allowed(field, value))
                throw new DomainException(400, "seek.filter_deep", "Choose from the list");
        var f = await db.Set<SeekFilter>().SingleOrDefaultAsync(x => x.AccountId == me, ct);
        if (f is null) db.Add(f = new SeekFilter { AccountId = me });
        (f.AgeMin, f.AgeMax, f.City, f.Oath, f.Children, f.Smoking, f.Drinking) =
            (req.AgeMin, req.AgeMax, req.City, req.Oath, req.Children, req.Smoking, req.Drinking);
        live.ToAccount(me, LiveKinds.SeekChanged, me);
        await db.SaveChangesAsync(ct);
        return await FiltersAsync(me, ct);
    }

    private static bool Active(SeekFilter f) =>
        f.AgeMin is not null || f.AgeMax is not null || f.City is not null || f.Oath is not null || f.Children is not null
        || f.Smoking is not null || f.Drinking is not null;

    private Task<Guid?> LastPassAsync(Guid me, CancellationToken ct)
    {
        var today = clock.TodayUb;
        return db.Set<SeekPass>().Where(x => x.AccountId == me && x.Day == today).OrderByDescending(x => x.PassedAt)
            .Select(x => (Guid?)x.TargetId).FirstOrDefaultAsync(ct);
    }

    public async Task<BondView> SummonAsync(Guid me, Guid target, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.SeekEnabled)) throw new DomainException(409, "seek.closed", "Seek is closed for now");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await bonds.LockPeopleAsync(ct, me, target);
        var p = await Me(me, ct);
        if (await UsedTodayAsync(me, ct) >= CandlesPerDay(p, await membership.PerksAsync(me, ct), config))
            throw new DomainException(409, "seek.no_candles", "Your candles are spent for tonight");
        if ((await CandidatesAsync(p, target, null, ct)).Count == 0)
            throw new DomainException(409, "seek.gone", "They have walked on");
        var theirTier = await db.Set<Profile.Profile>().Where(x => x.AccountId == target).Select(x => x.Tier).SingleAsync(ct);
        var bond = await bonds.CreateAsync(me, target, p.Tier, theirTier, ct);
        push.Send(target, PushKinds.BondMade, bond.Id, p.Name);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await bonds.GetAsync(me, bond.Id, ct);
    }

    public async Task PassAsync(Guid me, Guid target, CancellationToken ct = default)
    {
        if (!await db.Set<Account>().AnyAsync(a => a.Id == target, ct))
            throw new DomainException(404, "seek.not_found", "No such traveller");
        var today = clock.TodayUb;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO seek_passes ("AccountId", "TargetId", "Day", "PassedAt") VALUES ({me}, {target}, {today}, {clock.UtcNow})
            ON CONFLICT DO NOTHING
            """, ct);
        live.ToAccount(me, LiveKinds.SeekChanged, me);
        await tx.CommitAsync(ct);
    }

    /// The companions `me` may see, best first — or, with `only`, whether that one person is among
    /// them. One indexed query; discovery never loads every eligible person. A member's filters only
    /// narrow the set; the order is everyone's order.
    private async Task<List<Guid>> CandidatesAsync(Profile.Profile me, Guid? only, SeekFilter? filter, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var hallBonus = config.Int(ConfigKeys.SeatsHallBonus);
        var highBonus = config.Int(ConfigKeys.SeatsHighTableBonus);
        var f = filter ?? new SeekFilter();
        // Born on or before this day is at least AgeMin; born after this day is at most AgeMax.
        DateOnly? bornBy = f.AgeMin is { } lo ? clock.TodayUb.AddYears(-lo) : null;
        DateOnly? bornAfter = f.AgeMax is { } hi ? clock.TodayUb.AddYears(-(hi + 1)) : null;
        var want = me.Gender == "Male" ? "Female" : "Male";
        var region = MongoliaGeo.All.FirstOrDefault(c => c.Name == me.City)?.Region;
        var sameRegion = MongoliaGeo.All.Where(c => c.Region == region).Select(c => c.Name).ToArray();
        var today = clock.TodayUb;
        var myTier = Tiers.Index(me.Tier);
        var seatsBase = config.Int(ConfigKeys.SeatsBase);
        return await db.Database.SqlQuery<Guid>($"""
            SELECT p."AccountId" AS "Value"
            FROM profiles p
            JOIN accounts a ON a."Id" = p."AccountId"
            WHERE a."Status" = 'Active' AND a."DeleteAt" IS NULL AND p."PausedAt" IS NULL
              AND p."WelcomedAt" IS NOT NULL AND p."Gender" = {want}
              AND p."AccountId" <> {me.AccountId}
              AND (CAST({only} AS uuid) IS NULL OR p."AccountId" = {only})
              AND NOT EXISTS (SELECT 1 FROM bonds b WHERE
                    (b."AId" = {me.AccountId} AND b."BId" = p."AccountId") OR (b."BId" = {me.AccountId} AND b."AId" = p."AccountId"))
              AND NOT EXISTS (SELECT 1 FROM blocks k WHERE
                    (k."BlockerId" = {me.AccountId} AND k."BlockedId" = p."AccountId") OR (k."BlockedId" = {me.AccountId} AND k."BlockerId" = p."AccountId"))
              AND NOT EXISTS (SELECT 1 FROM seek_passes s WHERE s."AccountId" = {me.AccountId} AND s."Day" = {today} AND s."TargetId" = p."AccountId")
              AND (SELECT count(*) FROM bonds l WHERE (l."AId" = p."AccountId" OR l."BId" = p."AccountId") AND l."State" = 'Live')
                  < {seatsBase} + CASE p."Tier" WHEN 'Opal' THEN 1 WHEN 'Amethyst' THEN 2 WHEN 'Sapphire' THEN 3 WHEN 'Ruby' THEN 4 WHEN 'Emerald' THEN 5 ELSE 0 END
                    + COALESCE((SELECT max(CASE g."Floor" WHEN 'HighTable' THEN {highBonus} WHEN 'Hall' THEN {hallBonus} ELSE 0 END)
                                FROM membership_grants g WHERE g."AccountId" = p."AccountId" AND g."RevokedAt" IS NULL
                                  AND g."StartsAt" <= {now} AND g."EndsAt" > {now}), 0)
              AND (CAST({bornBy} AS date) IS NULL OR p."BirthDate" <= {bornBy})
              AND (CAST({bornAfter} AS date) IS NULL OR p."BirthDate" > {bornAfter})
              AND (CAST({f.City} AS text) IS NULL OR p."City" = {f.City})
              AND (CAST({f.Oath} AS text) IS NULL OR p."Oath" = {f.Oath})
              AND (CAST({f.Children} AS text) IS NULL OR p."Children" = {f.Children})
              AND (CAST({f.Smoking} AS text) IS NULL OR p."Smoking" = {f.Smoking})
              AND (CAST({f.Drinking} AS text) IS NULL OR p."Drinking" = {f.Drinking})
            ORDER BY COALESCE(p."City" = {me.City}, false) DESC,
                     COALESCE(p."City" = ANY({sameRegion}), false) DESC,
                     COALESCE(p."Oath" = {me.Oath}, false) DESC,
                     abs(CASE p."Tier" WHEN 'Opal' THEN 1 WHEN 'Amethyst' THEN 2 WHEN 'Sapphire' THEN 3 WHEN 'Ruby' THEN 4 WHEN 'Emerald' THEN 5 ELSE 0 END - {myTier}),
                     p."LastSeenAt" DESC,
                     p."Reputation" DESC,
                     p."AccountId"
            LIMIT 1
            """).ToListAsync(ct);
    }

    /// Whether two people may be bonded by someone else's hand (a thread, the square): the same rule
    /// as Seek — finished, active, not paused or leaving, a man and a woman, never bonded, neither
    /// cast out — without Seek's daily passes or seats.
    public async Task<bool> PairableAsync(Guid x, Guid y, CancellationToken ct = default)
    {
        if (x == y) return false;
        var people = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => (p.AccountId == x || p.AccountId == y) && p.PausedAt == null && p.WelcomedAt != null
                && db.Set<Account>().Any(a => a.Id == p.AccountId && a.Status == AccountStatus.Active && a.DeleteAt == null))
            .Select(p => p.Gender).ToListAsync(ct);
        if (people.Count != 2 || !people.Contains("Male") || !people.Contains("Female")) return false;
        var (a, b) = Bond.Pair(x, y);
        if (await db.Set<Bond>().AnyAsync(k => k.AId == a && k.BId == b, ct)) return false;
        return !await db.Set<Safety.Block>().AnyAsync(k =>
            (k.BlockerId == x && k.BlockedId == y) || (k.BlockerId == y && k.BlockedId == x), ct);
    }

    private async Task<CandidateView> CandidateAsync(Guid id, CancellationToken ct)
    {
        var p = await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(x => x.AccountId == id, ct);
        var portrait = (await photos.FirstPortraitsAsync(new Dictionary<Guid, bool> { [id] = false }, ct)).GetValueOrDefault(id);
        return new CandidateView(id, p.Name, ProfileService.AgeOn(p.BirthDate, clock.TodayUb), p.Tier,
            BondService.Place(p.City, district: false), p.Oath, p.Bio, portrait);
    }

    private Task<int> UsedTodayAsync(Guid me, CancellationToken ct)
    {
        var today = clock.TodayUb;
        return db.Set<Bond>().CountAsync(b => b.SummonerId == me && b.SummonDay == today && b.Origin == BondOrigins.Seek, ct);
    }

    private async Task<Profile.Profile> Me(Guid me, CancellationToken ct)
    {
        var p = await db.Set<Profile.Profile>().AsNoTracking().SingleOrDefaultAsync(x => x.AccountId == me, ct);
        if (p?.WelcomedAt is null) throw new DomainException(409, "profile.unfinished", "Finish your character first");
        return p;
    }

    private DateTimeOffset NextDawn()
    {
        var tomorrow = clock.TodayUb.AddDays(1).ToDateTime(TimeOnly.MinValue);
        return new DateTimeOffset(tomorrow, Ub.GetUtcOffset(tomorrow)).ToUniversalTime();
    }
}
