using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Score;

public sealed class ScoreService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, Membership.MembershipService membership)
{
    /// Ger rests: a member's missed dawns are kept, up to the floor's number a moon (the moon is
    /// the Ulaanbaatar calendar month). Spent on return, never asked for.
    public async Task<GerRestView> GerRestsAsync(Guid accountId, CancellationToken ct = default)
    {
        var perMoon = (await membership.PerksAsync(accountId, ct)).GerRests;
        var today = clock.TodayUb;
        var moon = new DateOnly(today.Year, today.Month, 1);
        var spent = await db.Set<GerRest>().Where(r => r.AccountId == accountId && r.Day >= moon).CountAsync(ct);
        var kept = await db.Set<GerRest>().Where(r => r.AccountId == accountId).MaxAsync(r => (DateOnly?)r.Day, ct);
        return new GerRestView(Math.Max(0, perMoon - spent), perMoon, kept);
    }

    /// Days missed since the last dawn that ger rests can keep; null when the streak is broken.
    public static int? Keepable(DateOnly? lastDawn, DateOnly today, int left)
    {
        if (lastDawn is not { } d) return null;
        var missed = today.DayNumber - d.DayNumber - 1;
        if (missed <= 0) return 0;
        return missed <= left ? missed : null;
    }

    private sealed record Applied(int Old, int New, string Tier);

    /// Moves points by `amount` (never below 0), records the deed, recomputes the tier. Runs inside
    /// the caller's transaction (it throws without one) so the deed and the cause commit together;
    /// the caller saves. Returns the amount actually applied.
    public async Task<int> AwardAsync(Guid accountId, string kind, int amount, Guid? bondId = null, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Points move only inside a transaction");
        if (amount == 0) return 0;

        // One statement, row-locked: two letters at once cannot lose an update.
        var row = (await db.Database.SqlQuery<Applied>($"""
            UPDATE profiles p SET "Points" = GREATEST(0, p."Points" + {amount})
            FROM (SELECT "Points" AS old FROM profiles WHERE "AccountId" = {accountId} FOR UPDATE) o
            WHERE p."AccountId" = {accountId}
            RETURNING o.old AS "Old", p."Points" AS "New", p."Tier" AS "Tier"
            """).ToListAsync(ct)).SingleOrDefault()
            ?? throw new DomainException(409, "profile.missing", "Create your character first");

        var applied = row.New - row.Old;
        if (applied == 0) return 0;
        var now = clock.UtcNow;
        db.Add(new ScoreEvent
        {
            AccountId = accountId, Kind = kind, Amount = applied, BondId = bondId, Day = clock.TodayUb, CreatedAt = now,
        });
        // Saved here, not left to the caller: the points above are already written, and a caller
        // that saves nothing after awarding (a claim without a chest) would lose the deed.
        await db.SaveChangesAsync(ct);

        var tier = Tiers.For(row.New, config);
        if (tier != row.Tier)
        {
            var up = Tiers.Index(tier) > Tiers.Index(row.Tier);
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE profiles SET "Tier" = {tier},
                  "TierUpPending" = CASE WHEN {up} THEN {tier} ELSE NULL END
                WHERE "AccountId" = {accountId}
                """, ct);
            live.ToAccount(accountId, LiveKinds.ProfileUpdated, accountId);
            live.ToAdmins(LiveKinds.UserUpdated, accountId);
        }
        live.ToAccount(accountId, LiveKinds.ScoreChanged, accountId);
        return applied;
    }

    /// Returning on a new Ulaanbaatar day: +dawn × streak (streak capped), and the seventh-dawn bonus.
    public async Task<DawnView> DawnAsync(Guid accountId, CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var p = await db.Set<Profile.Profile>()
            .FromSqlInterpolated($"""SELECT * FROM profiles WHERE "AccountId" = {accountId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        p.LastSeenAt = clock.UtcNow;
        if (p.LastDawn == today || p.WelcomedAt is null)
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return new DawnView(0, p.Streak, false);
        }

        // Missed dawns a ger rest can keep are kept (and spent); otherwise the streak starts again.
        var left = p.LastDawn < today.AddDays(-1) ? (await GerRestsAsync(accountId, ct)).Left : 0;
        var keep = Keepable(p.LastDawn, today, left);
        if (keep > 0)
            for (var day = p.LastDawn!.Value.AddDays(1); day < today; day = day.AddDays(1))
                db.Add(new GerRest { AccountId = accountId, Day = day });
        p.Streak = keep is not null ? p.Streak + 1 : 1;
        p.LastDawn = today;
        await db.SaveChangesAsync(ct);
        var cap = config.Int(ConfigKeys.ScoreDawnStreakCap);
        var earned = await AwardAsync(accountId, DeedKinds.Dawn, config.Int(ConfigKeys.ScoreDawn) * Math.Min(p.Streak, cap), null, ct);
        var seventh = p.Streak % cap == 0;
        if (seventh) earned += await AwardAsync(accountId, DeedKinds.SeventhDawn, config.Int(ConfigKeys.ScoreSeventhDawn), null, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new DawnView(earned, p.Streak, seventh);
    }

    /// Paid once to each finished character (and, by the sweep, to any finished before stage 3).
    public async Task AwardFinishedAsync(Guid accountId, CancellationToken ct = default)
    {
        if (await db.Set<ScoreEvent>().AnyAsync(e => e.AccountId == accountId && e.Kind == DeedKinds.Finished, ct)) return;
        await AwardAsync(accountId, DeedKinds.Finished, config.Int(ConfigKeys.ScoreFinished), null, ct);
        // An ally answered a call: the bounty lands on both when the newcomer's character is finished.
        var caller = await db.Set<Auth.Account>().Where(a => a.Id == accountId).Select(a => a.CalledBy).SingleOrDefaultAsync(ct);
        if (caller is { } c && await db.Set<Profile.Profile>().AnyAsync(p => p.AccountId == c, ct))
        {
            var bounty = config.Int(ConfigKeys.AllyBounty);
            await AwardAsync(accountId, DeedKinds.Ally, bounty, null, ct);
            await AwardAsync(c, DeedKinds.AllyCalled, bounty, null, ct);
        }
    }

    public async Task<int> BackfillFinishedAsync(CancellationToken ct = default)
    {
        var owed = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => p.WelcomedAt != null && !db.Set<ScoreEvent>().Any(e => e.AccountId == p.AccountId && e.Kind == DeedKinds.Finished))
            .Select(p => p.AccountId).Take(500).ToListAsync(ct);
        foreach (var id in owed)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await AwardFinishedAsync(id, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
        return owed.Count;
    }

    /// Reputation never leaves 0–100. Runs in the caller's transaction.
    public Task DockAsync(Guid accountId, int by, CancellationToken ct = default) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE profiles SET \"Reputation\" = GREATEST(0, LEAST(100, \"Reputation\" - {by})) WHERE \"AccountId\" = {accountId}", ct);

    public async Task SeenTierUpAsync(Guid accountId, CancellationToken ct = default)
    {
        var p = await db.Set<Profile.Profile>().SingleOrDefaultAsync(x => x.AccountId == accountId, ct);
        if (p?.TierUpPending is null) return;
        p.TierUpPending = null;
        live.ToAccount(accountId, LiveKinds.ProfileUpdated, accountId);
        await db.SaveChangesAsync(ct);
    }

    /// Newest first, keyset-paged by (CreatedAt, Id).
    public async Task<DeedPage> DeedsAsync(Guid accountId, DateTimeOffset? before, int limit, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var q = db.Set<ScoreEvent>().AsNoTracking().Where(e => e.AccountId == accountId);
        if (before is { } b) q = q.Where(e => e.CreatedAt < b);
        var rows = await q.OrderByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id).Take(limit + 1)
            .Select(e => new DeedView(e.Id, e.Kind, e.Amount, e.BondId, e.Day, e.CreatedAt)).ToListAsync(ct);
        return new DeedPage(rows.Take(limit).ToList(), rows.Count > limit ? rows[limit - 1].CreatedAt : null);
    }

    public IReadOnlyList<TierView> Ladder()
    {
        var t = Tiers.Thresholds(config);
        return Tiers.Names.Select((n, i) => new TierView(n, t[i], Tiers.Candles(t[i], i, config))).ToList();
    }
}
