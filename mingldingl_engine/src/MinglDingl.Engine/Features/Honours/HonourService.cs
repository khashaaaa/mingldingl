using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Honours;

/// Honours are read from what someone has already done (deeds, bonds, meetings), never counted
/// separately, so nothing can drift. Checking writes the newly earned ones; the ceremony plays for
/// each until it is marked seen.
public sealed class HonourService(AppDb db, IClock clock, ILiveOutbox live, FestivalService festivals)
{
    private const int TrueToWordKept = 5;
    private const int FlamekeeperRites = 3;
    private const int CartographerDistricts = 3;
    private const int TenWords = 10;
    private const int ScarClosedBy = 2;

    private sealed record Kept(Guid MeetingId, Guid BondId, Guid Other, DateTimeOffset At, DateTimeOffset ClosedAt,
        string Venue, string? VenueMn, string District, MeetingOutcome Outcome, Guid? NoShowOf);

    public async Task<IReadOnlyList<HonourView>> ListAsync(Guid me, CancellationToken ct = default)
    {
        var (added, held) = await CheckCoreAsync(me, quietly: false, ct);
        // Only a new honour makes the rows read by the check stale.
        if (added > 0) held = await db.Set<HonourEarned>().AsNoTracking().Where(h => h.AccountId == me).ToListAsync(ct);
        return HonourKeys.All.Select(d =>
        {
            var mine = held.Where(h => h.Key == d.Key).OrderBy(h => h.EarnedAt).ToList();
            return new HonourView(d.Key, d.Kind, mine.Count > 0, mine.FirstOrDefault()?.EarnedAt, mine.Count,
                mine.Any(h => h.SeenAt is null));
        }).ToList();
    }

    public async Task SeenAsync(Guid me, string key, CancellationToken ct = default)
    {
        // Live events go out on commit: an ExecuteUpdate alone would never send this one.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var n = await db.Set<HonourEarned>().Where(h => h.AccountId == me && h.Key == key && h.SeenAt == null)
            .ExecuteUpdateAsync(u => u.SetProperty(h => h.SeenAt, clock.UtcNow), ct);
        if (n > 0) live.ToAccount(me, LiveKinds.HonourEarned, me);
        await tx.CommitAsync(ct);
    }

    /// Writes any honour now earned and not yet held. quietly: marked seen (the first backfill —
    /// no ceremony for history). Returns how many were new.
    public async Task<int> CheckAsync(Guid me, bool quietly, CancellationToken ct = default) =>
        (await CheckCoreAsync(me, quietly, ct)).Added;

    private async Task<(int Added, List<HonourEarned> Held)> CheckCoreAsync(Guid me, bool quietly, CancellationToken ct)
    {
        var rows = await db.Set<HonourEarned>().AsNoTracking().Where(h => h.AccountId == me).ToListAsync(ct);
        var held = rows.Select(h => (h.Key, h.Year)).ToHashSet();
        var earned = await EarnedAsync(me, ct);
        if (earned.All(held.Contains)) return (0, rows);
        var now = clock.UtcNow;
        var added = 0;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        foreach (var (key, year) in earned.Where(e => !held.Contains(e)))
        {
            var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO honours ("AccountId", "Key", "Year", "EarnedAt", "SeenAt")
                VALUES ({me}, {key}, {year}, {now}, {(quietly ? now : null)})
                ON CONFLICT DO NOTHING
                """, ct);
            added += inserted;
        }
        if (added > 0 && !quietly) live.ToAccount(me, LiveKinds.HonourEarned, me);
        await tx.CommitAsync(ct);
        return (added, rows);
    }

    /// The first time honours exist, everyone's history is written without ceremony.
    public static async Task BackfillAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        await using var scope = sp.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        if (await db.Set<HonourEarned>().AnyAsync(ct)) return;
        var svc = scope.ServiceProvider.GetRequiredService<HonourService>();
        var ids = await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.WelcomedAt != null)
            .Select(p => p.AccountId).ToListAsync(ct);
        foreach (var id in ids) await svc.CheckAsync(id, quietly: true, ct);
    }

    public async Task<EncounterLogView> LogAsync(Guid me, CancellationToken ct = default)
    {
        var rows = await MeetingsAsync(me, ct);
        var names = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => rows.Select(r => r.Other).Contains(p.AccountId))
            .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        var standing = await StandingAsync(me, rows, ct);
        var charted = new HashSet<string>();
        var log = new List<EncounterLogRow>();
        foreach (var r in rows.OrderBy(r => r.ClosedAt))
        {
            string? first = r.Outcome == MeetingOutcome.Kept && charted.Add(r.District) ? r.District : null;
            var outcome = r.Outcome switch
            {
                MeetingOutcome.Kept => "kept",
                MeetingOutcome.NoShow when r.NoShowOf == me => "missed",
                MeetingOutcome.NoShow => "noShow",
                MeetingOutcome.Disputed => "disputed",
                MeetingOutcome.Excused => "excused",
                _ => "unanswered",
            };
            log.Add(new EncounterLogRow(r.MeetingId, r.BondId, names.GetValueOrDefault(r.Other, ""), r.Venue, r.VenueMn, r.At, outcome, first));
        }
        log.Reverse();
        return new EncounterLogView(standing, log);
    }

    private async Task<List<Kept>> MeetingsAsync(Guid me, CancellationToken ct) =>
        await (from m in db.Set<Meeting>().AsNoTracking()
               join b in db.Set<Bond>() on m.BondId equals b.Id
               join v in db.Set<Venue>() on m.VenueId equals v.Id
               where (b.AId == me || b.BId == me) && m.State == MeetingState.Closed && m.Outcome != null
               select new Kept(m.Id, b.Id, b.AId == me ? b.BId : b.AId, m.At, m.ClosedAt ?? m.At, v.Name, v.NameMn, v.District,
                   m.Outcome!.Value, m.NoShowOf))
            .ToListAsync(ct);

    private async Task<StandingView> StandingAsync(Guid me, List<Kept> rows, CancellationToken ct)
    {
        var kept = rows.Where(r => r.Outcome == MeetingOutcome.Kept).OrderBy(r => r.ClosedAt).ToList();
        var missed = rows.Count(r => r.NoShowOf == me);
        var scars = await db.Set<ScoreEvent>().AsNoTracking()
            .Where(e => e.AccountId == me && e.Kind == DeedKinds.GoneCold).OrderBy(e => e.CreatedAt)
            .Select(e => e.CreatedAt).ToListAsync(ct);
        // Each scar is closed by the next two kept encounters after it that no earlier scar used.
        var used = 0;
        var closed = 0;
        foreach (var at in scars)
        {
            while (used < kept.Count && kept[used].ClosedAt < at) used++;
            if (kept.Count - used < ScarClosedBy) break;
            used += ScarClosedBy;
            closed++;
        }
        var districts = kept.Select(k => k.District).Distinct().ToList();
        return new StandingView(kept.Count, kept.Count + missed, scars.Count - closed, closed, districts);
    }

    /// Wanderings kept, with anyone, to be a Fellow Traveller.
    public const int FellowTravellerWanderings = 3;

    private async Task<HashSet<(string Key, int Year)>> EarnedAsync(Guid me, CancellationToken ct)
    {
        var got = new HashSet<(string, int)>();
        void Earn(string key, bool when) { if (when) got.Add((key, 0)); }

        var deeds = (await db.Set<ScoreEvent>().AsNoTracking().Where(e => e.AccountId == me)
            .GroupBy(e => e.Kind).Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct))
            .ToDictionary(x => x.Key, x => x.N);
        int Deeds(string kind) => deeds.GetValueOrDefault(kind);

        var bonds = await db.Set<Bond>().AsNoTracking().Where(b => b.AId == me || b.BId == me)
            .Select(b => new { b.Seals, b.State, b.Origin, Mine = b.AId == me ? b.LettersA : b.LettersB }).ToListAsync(ct);
        var meetings = await MeetingsAsync(me, ct);
        var standing = await StandingAsync(me, meetings, ct);
        var pledged = await db.Set<Meeting>().AsNoTracking().AnyAsync(m => m.SwornAt != null
            && db.Set<Bond>().Any(b => b.Id == m.BondId && (b.AId == me || b.BId == me)), ct);
        var proven = await db.Set<Profile.Profile>().AsNoTracking()
            .AnyAsync(p => p.AccountId == me && p.OathProvenAt != null, ct);

        Earn(HonourKeys.SealBreaker, bonds.Any(b => b.Seals >= 1));
        Earn(HonourKeys.BondKeeper, bonds.Any(b => b.Seals >= 4));
        Earn(HonourKeys.Flamekeeper, Deeds(DeedKinds.Rite) >= FlamekeeperRites);
        Earn(HonourKeys.TrueToWord, standing.Kept >= TrueToWordKept && standing.Kept == standing.Counted);
        // Every chamber of one Campaign cleared, the boss's seal last or not.
        Earn(HonourKeys.OathKeeper, Deeds(DeedKinds.CampaignBoss) > 0 && await db.Set<Campaign.ChamberCleared>().AsNoTracking()
            .Where(c => db.Set<Bond>().Any(b => b.Id == c.BondId && (b.AId == me || b.BId == me)))
            .GroupBy(c => c.BondId).AnyAsync(g => g.Count() == Campaign.Chambers.All.Count, ct));
        Earn(HonourKeys.SevenDawns, Deeds(DeedKinds.SeventhDawn) > 0);
        Earn(HonourKeys.AllyCaller, Deeds(DeedKinds.AllyCalled) > 0);
        Earn(HonourKeys.ThreadWeaver, Deeds(DeedKinds.ThreadSparked) > 0);
        Earn(HonourKeys.Mended, standing.ClosedScars > 0);
        Earn(HonourKeys.Cartographer, standing.Districts.Count >= CartographerDistricts);
        Earn(HonourKeys.Hearthbound, bonds.Any(b => b.State == BondState.Retired));
        Earn(HonourKeys.FateSeer, bonds.Any(b => b.Origin == BondOrigins.Square));
        Earn(HonourKeys.FellowTraveller, await db.Set<Wanderings.WanderingTaken>().AsNoTracking().CountAsync(t => t.KeptAt != null
            && db.Set<Bond>().Any(b => b.Id == t.BondId && (b.AId == me || b.BId == me)), ct) >= FellowTravellerWanderings);
        Earn(HonourKeys.FirstBond, bonds.Count > 0);
        Earn(HonourKeys.IceBroken, Deeds(DeedKinds.Icebreaker) > 0);
        Earn(HonourKeys.FirstTrial, Deeds(DeedKinds.Trial) > 0);
        Earn(HonourKeys.TenWords, bonds.Any(b => b.Mine >= TenWords));
        Earn(HonourKeys.FirstPledge, pledged);
        Earn(HonourKeys.FaceToFlame, Deeds(DeedKinds.Rite) > 0);
        Earn(HonourKeys.OathFulfilled, proven);

        // A kept encounter whose meeting fell inside a festival with an honour: once that year.
        var kept = meetings.Where(m => m.Outcome == MeetingOutcome.Kept).ToList();
        if (kept.Count > 0)
            foreach (var f in await festivals.PastAndCurrentAsync(ct))
            {
                if (!FestivalKeys.WithHonour.Contains(f.Key)) continue;
                if (kept.Any(k => UbDays.DayOf(k.At) >= f.Starts && UbDays.DayOf(k.At) <= f.Ends))
                    got.Add((f.Key == FestivalKeys.Naadam ? HonourKeys.Naadam : HonourKeys.TsagaanSar, f.Starts.Year));
            }
        return got;
    }
}
