using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Quests;

/// Today's three quests and the week's one. Progress is read from what already happened (deeds,
/// bonds, letters, meetings) — the app never reports it — so a quest can never be faked or drift.
public sealed class QuestService(AppDb db, IClock clock, IConfig config, ScoreService score, ILiveOutbox live)
{
    public async Task<QuestBoard> BoardAsync(Guid me, CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        var week = UbDays.WeekStart(today);
        var claims = await db.Set<QuestClaim>().AsNoTracking()
            .Where(c => c.AccountId == me && (c.Period == today || c.Period == week)).ToListAsync(ct);
        // This week's deeds by kind and day, in one read: every deed quest on the board counts from it.
        var deeds = await db.Set<ScoreEvent>().AsNoTracking()
            .Where(e => e.AccountId == me && e.Day >= week && e.Day < week.AddDays(7))
            .GroupBy(e => new { e.Kind, e.Day }).Select(g => new DeedCount(g.Key.Kind, g.Key.Day, g.Count()))
            .ToListAsync(ct);
        var daily = new List<QuestView>();
        foreach (var q in DailyFor(me, today))
            daily.Add(await ViewAsync(me, q, today, claims, deeds, ct));
        var weekly = new List<QuestView> { await ViewAsync(me, WeeklyFor(me, week), week, claims, deeds, ct) };
        var streak = await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == me)
            .Select(p => new { p.Streak, p.LastDawn }).SingleOrDefaultAsync(ct);
        // A streak whose last return was before yesterday is broken — unless ger rests will keep the gap.
        var rests = await score.GerRestsAsync(me, ct);
        var alive = streak is { LastDawn: { } d } && ScoreService.Keepable(d, today, rests.Left) is not null
            ? streak.Streak : 0;
        var cap = config.Int(ConfigKeys.ScoreDawnStreakCap);
        // The character sheet's two counts ride on the board, whose events already move them.
        var chests = await db.Set<Chest>().CountAsync(c => c.AccountId == me && c.OpenedAt == null, ct);
        var districts = await (from m in db.Set<Meeting>()
                               join b in db.Set<Bond>() on m.BondId equals b.Id
                               join v in db.Set<Venues.Venue>() on m.VenueId equals v.Id
                               where (b.AId == me || b.BId == me) && m.State == MeetingState.Closed && m.Outcome == MeetingOutcome.Kept
                               select v.District).Distinct().CountAsync(ct);
        return new QuestBoard(daily, weekly, alive, alive == 0 ? 0 : (alive - 1) % cap + 1, cap, today, week.AddDays(6), rests,
            chests, districts);
    }

    public async Task<ClaimResult> ClaimAsync(Guid me, string kind, CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        var week = UbDays.WeekStart(today);
        var dailies = DailyFor(me, today);
        var def = dailies.FirstOrDefault(q => q.Kind == kind)
            ?? (WeeklyFor(me, week) is { } w && w.Kind == kind ? w : null)
            ?? throw new DomainException(404, "quest.not_found", "That quest is not on today's board");
        var period = def.Period == QuestKinds.Daily ? today : week;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Serialise one person's claims so the chest is given exactly once.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM profiles WHERE \"AccountId\" = {me} FOR UPDATE", ct);
        var claims = await db.Set<QuestClaim>().Where(c => c.AccountId == me && (c.Period == today || c.Period == week)).ToListAsync(ct);
        if (claims.Any(c => c.Kind == kind && c.Period == period))
            throw new DomainException(409, "quest.claimed", "That bounty is already yours");
        if (await ProgressAsync(me, kind, period, ct) < def.Target)
            throw new DomainException(409, "quest.not_done", "That quest is not done yet");

        var points = config.Int(def.PointsKey);
        db.Add(new QuestClaim { AccountId = me, Kind = kind, Period = period, Points = points, ClaimedAt = clock.UtcNow });
        await db.SaveChangesAsync(ct);
        var earned = await score.AwardAsync(me, DeedKinds.Quest, points, null, ct);

        ChestView? chest = null;
        if (def.Period == QuestKinds.Daily
            && dailies.All(q => q.Kind == kind || claims.Any(c => c.Kind == q.Kind && c.Period == today)))
        {
            var c = new Chest { Id = Guid.CreateVersion7(), AccountId = me, FromQuest = kind, Day = today, CreatedAt = clock.UtcNow };
            db.Add(c);
            await db.SaveChangesAsync(ct);
            chest = View(c);
        }
        live.ToAccount(me, LiveKinds.QuestsUpdated, me);
        await tx.CommitAsync(ct);
        return new ClaimResult(earned, chest);
    }

    public async Task<IReadOnlyList<ChestView>> ChestsAsync(Guid me, CancellationToken ct = default) =>
        (await db.Set<Chest>().AsNoTracking().Where(c => c.AccountId == me && c.OpenedAt == null)
            .OrderBy(c => c.CreatedAt).ToListAsync(ct)).Select(View).ToList();

    public async Task<int> OpenChestAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var c = await db.Set<Chest>().FromSqlInterpolated($"SELECT * FROM chests WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        if (c is null || c.AccountId != me) throw new DomainException(404, "chest.not_found", "That chest is not in your satchel");
        if (c.OpenedAt is not null) throw new DomainException(409, "chest.opened", "That chest is already open");
        c.OpenedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        var earned = await score.AwardAsync(me, DeedKinds.Chest, config.Int(ConfigKeys.ChestPoints), null, ct);
        live.ToAccount(me, LiveKinds.QuestsUpdated, me);
        await tx.CommitAsync(ct);
        return earned;
    }

    private ChestView View(Chest c) => new(c.Id, c.FromQuest, config.Int(ConfigKeys.ChestPoints), c.CreatedAt);

    private sealed record DeedCount(string Kind, DateOnly Day, int N);

    private async Task<QuestView> ViewAsync(Guid me, QuestDefinition q, DateOnly period, List<QuestClaim> claims,
        List<DeedCount> deeds, CancellationToken ct)
    {
        var progress = Math.Min(q.Target, await ProgressAsync(me, q.Kind, period, ct, deeds));
        var claimed = claims.Any(c => c.Kind == q.Kind && c.Period == period);
        return new QuestView(q.Kind, q.Period, progress, q.Target, config.Int(q.PointsKey), progress >= q.Target, claimed);
    }

    /// The draw for a person's day: Light the hearth, then two of the pool, the same all day.
    public static IReadOnlyList<QuestDefinition> DailyFor(Guid me, DateOnly day)
    {
        var rng = new Random(Seed(me, day));
        return [QuestKinds.Hearth, .. QuestKinds.DailyPool.OrderBy(_ => rng.Next()).Take(2)];
    }

    public static QuestDefinition WeeklyFor(Guid me, DateOnly week) =>
        QuestKinds.WeeklyPool[new Random(Seed(me, week)).Next(QuestKinds.WeeklyPool.Count)];

    private static int Seed(Guid me, DateOnly day) => BitConverter.ToInt32(me.ToByteArray(), 12) ^ day.DayNumber * 7919;

    /// known: this week's deed counts when the caller has read them (the board); otherwise asked.
    private async Task<int> ProgressAsync(Guid me, string kind, DateOnly period, CancellationToken ct, List<DeedCount>? known = null)
    {
        var weekEnd = period.AddDays(7);
        Task<int> Deeds(string deed, bool weekly) => known is not null
            ? Task.FromResult(known.Where(d => d.Kind == deed && (weekly ? d.Day >= period && d.Day < weekEnd : d.Day == period)).Sum(d => d.N))
            : db.Set<ScoreEvent>().AsNoTracking().CountAsync(e => e.AccountId == me
                && e.Kind == deed && (weekly ? e.Day >= period && e.Day < weekEnd : e.Day == period), ct);
        var from = UbDays.Start(period);
        var to = UbDays.Start(weekEnd);
        return kind switch
        {
            QuestKinds.LightHearth => await db.Set<Profile.Profile>().AsNoTracking()
                .CountAsync(p => p.AccountId == me && p.LastDawn == period, ct),
            QuestKinds.AnswerLetters => await Deeds(DeedKinds.Reply, false),
            QuestKinds.FirstLetter => await Deeds(DeedKinds.FirstLetter, false),
            QuestKinds.Summon => await db.Set<Bond>().AsNoTracking()
                .CountAsync(b => b.SummonerId == me && b.SummonDay == period && b.Origin == BondOrigins.Seek, ct),
            QuestKinds.BreakIce => await Deeds(DeedKinds.Icebreaker, false),
            QuestKinds.TakeTrial => await Deeds(DeedKinds.Trial, false),
            QuestKinds.LightRite => await Deeds(DeedKinds.Rite, true),
            QuestKinds.KeepEncounter => await db.Set<Meeting>().AsNoTracking().CountAsync(m => m.Outcome == MeetingOutcome.Kept
                && m.ClosedAt >= from && m.ClosedAt < to
                && db.Set<Bond>().Any(b => b.Id == m.BondId && (b.AId == me || b.BId == me)), ct),
            QuestKinds.BreakSeal => await db.Set<Letter>().AsNoTracking().CountAsync(l => l.SealBroken != null
                && l.CreatedAt >= from && l.CreatedAt < to
                && db.Set<Bond>().Any(b => b.Id == l.BondId && (b.AId == me || b.BId == me)), ct),
            _ => 0,
        };
    }
}
