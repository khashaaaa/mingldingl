using System.Reflection;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Payments;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;
using Npgsql;

namespace MinglDingl.Engine.Features.Stats;

/// The tables under each statistics group, the dashboard's "today", deletions and the engine room.
/// These read the live tables directly: each is one small query over the range.
public sealed class StatsTables(AppDb db, IClock clock, IConfig config, IConfiguration settings, PushQueue pushQueue,
    IHttpClientFactory http, OpsClock ops, IHostEnvironment env)
{
    public async Task<StatTable> TableAsync(string group, DateOnly from, DateOnly to, StatFilter f, CancellationToken ct = default)
    {
        var (start, end) = (UbDays.Start(from), UbDays.Start(to.AddDays(1)));
        return group switch
        {
            "growth" => await FunnelAsync(start, end, f, ct),
            "engagement" => await StreaksAsync(f, ct),
            "matching" => await SourcesAsync(start, end, f, ct),
            "encounters" => await VenuesAsync(start, end, ct),
            "square" => await BellsAsync(start, end, ct),
            "money" => await MoneyAsync(start, end, ct),
            "cohorts" => await CohortsAsync(from, to, f, ct),
            _ => throw new DomainException(404, "stats.group", "No such group"),
        };
    }

    /// People's own filter dimensions, as a WHERE over profiles p (and the account's floor now).
    private const string PeopleFilter = """
        (@city::text IS NULL OR p."City" = @city) AND (@gender::text IS NULL OR p."Gender" = @gender)
        AND (@tier::text IS NULL OR p."Tier" = @tier)
        AND (@band::text IS NULL OR CASE WHEN date_part('year', age(p."BirthDate")) < 25 THEN '18-24'
             WHEN date_part('year', age(p."BirthDate")) < 35 THEN '25-34' WHEN date_part('year', age(p."BirthDate")) < 45 THEN '35-44'
             ELSE '45+' END = @band)
        AND (@floor::text IS NULL OR COALESCE((SELECT max(CASE g."Floor" WHEN 'HighTable' THEN 'highTable' WHEN 'Hall' THEN 'hall' END)
             FROM membership_grants g WHERE g."AccountId" = p."AccountId" AND g."RevokedAt" IS NULL AND g."StartsAt" <= now()
             AND g."EndsAt" > now()), 'yard') = @floor)
        """;

    private static NpgsqlParameter[] Params(StatFilter f, params NpgsqlParameter[] more) =>
    [
        Text("city", f.City), Text("gender", f.Gender), Text("tier", f.Tier), Text("band", f.AgeBand), Text("floor", f.Floor), .. more,
    ];

    private static NpgsqlParameter Text(string name, string? value) =>
        new(name, NpgsqlTypes.NpgsqlDbType.Text) { Value = (object?)value ?? DBNull.Value };

    private static string Pct(long part, long whole) => whole == 0 ? "—" : $"{Math.Round(100.0 * part / whole)}%";

    /// Of the accounts made in the range, how many reached each onboarding step.
    private async Task<StatTable> FunnelAsync(DateTimeOffset start, DateTimeOffset end, StatFilter f, CancellationToken ct)
    {
        var min = config.Int(ConfigKeys.PhotosMin);
        // The person's dimensions only exist once they have a profile; a filter keeps only those.
        var filtered = f.City ?? f.Gender ?? f.AgeBand ?? f.Tier ?? f.Floor;
        var steps = await db.Database.SqlQueryRaw<int>($"""
            SELECT CASE WHEN p."AccountId" IS NULL THEN 1 WHEN p."Gender" IS NULL THEN 2
                        WHEN (SELECT count(*) FROM photos ph WHERE ph."AccountId" = a."Id") < @min THEN 3
                        WHEN p."Bio" IS NULL OR p."City" IS NULL THEN 4 WHEN p."Oath" IS NULL THEN 5
                        WHEN p."WelcomedAt" IS NULL THEN 6 ELSE 7 END AS "Value"
            FROM accounts a LEFT JOIN profiles p ON p."AccountId" = a."Id"
            WHERE a."CreatedAt" >= @start AND a."CreatedAt" < @end
              AND ({(filtered is null ? "true" : $"p.\"AccountId\" IS NOT NULL AND {PeopleFilter}")})
            """, Params(f, new NpgsqlParameter("min", min), new NpgsqlParameter("start", start), new NpgsqlParameter("end", end))).ToListAsync(ct);
        string[] names = ["1 · Name & age", "2 · Gender", "3 · Portraits", "4 · About", "5 · The Oath", "6 · Your tale is written", "In the world"];
        var total = steps.Count;
        return new StatTable(["Onboarding step", "Reached", "Left here", "Share"],
            [.. names.Select((n, i) =>
            {
                var reached = steps.Count(s => s >= i + 1);
                var left = i == 6 ? "—" : steps.Count(s => s == i + 1).ToString();
                return (IReadOnlyList<string>)[n, reached.ToString(), left, Pct(reached, total)];
            })]);
    }

    /// Where the dawn streaks stand now among the people filtered.
    private async Task<StatTable> StreaksAsync(StatFilter f, CancellationToken ct)
    {
        var today = clock.TodayUb;
        var streaks = await db.Database.SqlQueryRaw<int>($"""
            SELECT CASE WHEN p."LastDawn" >= @yesterday THEN p."Streak" ELSE 0 END AS "Value"
            FROM profiles p WHERE p."WelcomedAt" IS NOT NULL AND {PeopleFilter}
            """, Params(f, new NpgsqlParameter("yesterday", today.AddDays(-1)))).ToListAsync(ct);
        var total = streaks.Count;
        (string Name, Func<int, bool> In)[] bands = [("No streak", s => s == 0), ("1–2 dawns", s => s is 1 or 2), ("3–6 dawns", s => s is >= 3 and <= 6), ("7+ dawns", s => s >= 7)];
        return new StatTable(["Streak", "People", "Share"],
            [.. bands.Select(b => (IReadOnlyList<string>)[b.Name, streaks.Count(b.In).ToString(), Pct(streaks.Count(b.In), total)])]);
    }

    private sealed record SourceRow(string Origin, long Made, long Fourth, long Cold);

    private async Task<StatTable> SourcesAsync(DateTimeOffset start, DateTimeOffset end, StatFilter f, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<SourceRow>($"""
            SELECT b."Origin" AS "Origin", count(*)::bigint AS "Made", count(*) FILTER (WHERE b."Seals" >= 4)::bigint AS "Fourth",
                   count(*) FILTER (WHERE b."State" = 'Cold')::bigint AS "Cold"
            FROM bonds b JOIN profiles p ON p."AccountId" = b."AId"
            WHERE b."CreatedAt" >= @start AND b."CreatedAt" < @end AND {PeopleFilter}
            GROUP BY b."Origin" ORDER BY 2 DESC
            """, Params(f, new NpgsqlParameter("start", start), new NpgsqlParameter("end", end))).ToListAsync(ct);
        var names = new Dictionary<string, string> { ["seek"] = "Seek", ["thread"] = "Fated Thread", ["square"] = "Town Square" };
        return new StatTable(["Bonds by source", "Made", "Reached the 4th seal", "Gone cold"],
            [.. rows.Select(r => (IReadOnlyList<string>)[names.GetValueOrDefault(r.Origin, r.Origin), r.Made.ToString(), r.Fourth.ToString(), r.Cold.ToString()])]);
    }

    private sealed record VenueRow(string Name, string District, long Kept, double? Rating);

    private async Task<StatTable> VenuesAsync(DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<VenueRow>("""
            SELECT v."Name" AS "Name", v."District" AS "District", count(m.*)::bigint AS "Kept",
                   (SELECT avg(r."Stars")::float8 FROM venue_ratings r WHERE r."VenueId" = v."Id" AND r."Stars" > 0) AS "Rating"
            FROM venues v JOIN meetings m ON m."VenueId" = v."Id" AND m."Outcome" = 'Kept' AND m."ClosedAt" >= @start AND m."ClosedAt" < @end
            GROUP BY v."Id", v."Name", v."District" ORDER BY 3 DESC LIMIT 20
            """, new NpgsqlParameter("start", start), new NpgsqlParameter("end", end)).ToListAsync(ct);
        return new StatTable(["Top venues", "Kept here", "Rating", "District"],
            [.. rows.Select(r => (IReadOnlyList<string>)[r.Name, r.Kept.ToString(), r.Rating is { } x ? x.ToString("0.0") : "—", r.District])]);
    }

    private sealed record BellRow(string Name, int Seats, long Taken, int Rounds, long Bonds);

    private async Task<StatTable> BellsAsync(DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<BellRow>("""
            SELECT g."Name" AS "Name", g."Seats" AS "Seats", (SELECT count(*) FROM square_seats s WHERE s."GatheringId" = g."Id")::bigint AS "Taken",
                   g."Rounds" AS "Rounds", (SELECT count(*) FROM square_pairs q WHERE q."GatheringId" = g."Id" AND q."BondId" IS NOT NULL)::bigint AS "Bonds"
            FROM gatherings g WHERE g."StartsAt" >= @start AND g."StartsAt" < @end AND g."CancelledAt" IS NULL ORDER BY g."StartsAt" DESC
            """, new NpgsqlParameter("start", start), new NpgsqlParameter("end", end)).ToListAsync(ct);
        return new StatTable(["Bell", "Seats", "Rounds", "Bonds"],
            [.. rows.Select(r => (IReadOnlyList<string>)[r.Name, $"{r.Taken} of {r.Seats}", r.Rounds.ToString(), r.Bonds.ToString()])]);
    }

    private sealed record MoneyRow(string Floor, int Months, long Web, long Revenue);

    private async Task<StatTable> MoneyAsync(DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
    {
        var web = await db.Database.SqlQueryRaw<MoneyRow>("""
            SELECT i."Floor" AS "Floor", i."Months" AS "Months", count(*)::bigint AS "Web", sum(p."Amount")::bigint AS "Revenue"
            FROM payments p JOIN invoices i ON i."Id" = p."InvoiceId"
            WHERE p."State" = 'Credited' AND p."PaidAt" >= @start AND p."PaidAt" < @end
            GROUP BY 1, 2 ORDER BY 1, 2
            """, new NpgsqlParameter("start", start), new NpgsqlParameter("end", end)).ToListAsync(ct);
        var store = await db.Set<Membership.MembershipGrant>().AsNoTracking()
            .Where(g => g.Source == Membership.GrantSource.Store && g.StartsAt >= start && g.StartsAt < end)
            .GroupBy(g => new { g.Floor, g.Ref }).Select(x => new { x.Key.Floor, x.Key.Ref, N = x.Count() }).ToListAsync(ct);
        int MonthsOf(string productId) => productId.EndsWith("m3") ? 3 : productId.EndsWith("m6") ? 6 : 1;
        var keys = web.Select(w => (w.Floor, w.Months)).Concat(store.Select(s => (s.Floor.ToString(), MonthsOf(s.Ref)))).Distinct()
            .OrderBy(k => k.Item1).ThenBy(k => k.Item2);
        return new StatTable(["Floor · cycle", "Store", "Web (QPay)", "Web revenue"],
            [.. keys.Select(k =>
            {
                var w = web.FirstOrDefault(x => x.Floor == k.Item1 && x.Months == k.Item2);
                var s = store.Where(x => x.Floor.ToString() == k.Item1 && MonthsOf(x.Ref) == k.Item2).Sum(x => x.N);
                var name = $"{(k.Item1 == "HighTable" ? "The High Table" : "The Hall")} · {k.Item2} moon{(k.Item2 == 1 ? "" : "s")}";
                return (IReadOnlyList<string>)[name, s.ToString(), (w?.Web ?? 0).ToString(), $"{(w?.Revenue ?? 0):N0}₮"];
            })]);
    }

    private sealed record CohortRow(DateOnly Week, long People, long D1, long D7, long D30);

    /// Of each week's sign-ups in the range, the share that returned on day 1, 7 and 30.
    private async Task<StatTable> CohortsAsync(DateOnly from, DateOnly to, StatFilter f, CancellationToken ct)
    {
        var today = clock.TodayUb;
        var rows = await db.Database.SqlQueryRaw<CohortRow>($"""
            WITH c AS (
              SELECT a."Id", (a."CreatedAt" AT TIME ZONE 'Asia/Ulaanbaatar')::date AS d FROM accounts a
              JOIN profiles p ON p."AccountId" = a."Id"
              WHERE (a."CreatedAt" AT TIME ZONE 'Asia/Ulaanbaatar')::date BETWEEN @from AND @to AND {PeopleFilter})
            SELECT (date_trunc('week', c.d))::date AS "Week", count(*)::bigint AS "People",
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM score_events e WHERE e."AccountId" = c."Id" AND e."Kind" = 'dawn' AND e."Day" = c.d + 1))::bigint AS "D1",
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM score_events e WHERE e."AccountId" = c."Id" AND e."Kind" = 'dawn' AND e."Day" = c.d + 7))::bigint AS "D7",
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM score_events e WHERE e."AccountId" = c."Id" AND e."Kind" = 'dawn' AND e."Day" = c.d + 30))::bigint AS "D30"
            FROM c GROUP BY 1 ORDER BY 1
            """, Params(f, new NpgsqlParameter("from", from), new NpgsqlParameter("to", to))).ToListAsync(ct);
        string Share(CohortRow r, long n, int days) => r.Week.AddDays(6 + days) >= today ? "—" : Pct(n, r.People);
        return new StatTable(["Signed up", "People", "Day 1", "Day 7", "Day 30"],
            [.. rows.Select(r => (IReadOnlyList<string>)[$"Week of {r.Week:MMM d}", r.People.ToString(), Share(r, r.D1, 1), Share(r, r.D7, 7), Share(r, r.D30, 30)])]);
    }

    // —— the dashboard, deletions, the engine room ——

    public async Task<DashboardView> DashboardAsync(CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        var start = UbDays.Start(today);
        var active = await db.Set<Score.ScoreEvent>().CountAsync(e => e.Kind == "dawn" && e.Day == today, ct);
        var lastWeek = await db.Set<Score.ScoreEvent>().CountAsync(e => e.Kind == "dawn" && e.Day == today.AddDays(-7), ct);
        var bonds = await db.Set<Bonds.Bond>().CountAsync(b => b.CreatedAt >= start, ct);
        var money = await db.Set<Payment>().Where(p => p.State == PaymentState.Credited && p.PaidAt >= start).SumAsync(p => (int?)p.Amount, ct) ?? 0;
        var web = await db.Set<Payment>().CountAsync(p => p.State == PaymentState.Credited && p.PaidAt >= start, ct);
        var storeToday = await db.Set<Membership.MembershipGrant>().CountAsync(g => g.Source == Membership.GrantSource.Store && g.StartsAt >= start, ct);
        var reports = await db.Set<Safety.Report>().AsNoTracking().Where(r => r.ResolvedAt == null).OrderBy(r => r.CreatedAt).Take(50)
            .Select(r => new { r.Id, r.Reason, r.CreatedAt, r.ReporterId, r.TargetId }).ToListAsync(ct);
        var stuck = await (from p in db.Set<Payment>() join i in db.Set<Invoice>() on p.InvoiceId equals i.Id
                           where p.State == PaymentState.NeedsAttention orderby p.PaidAt
                           select new { p.Note, p.PaidAt, i.Name, i.Id }).Take(50).ToListAsync(ct);
        var deletions = await DeletionsAsync(ct);
        var names = await db.Set<Profile.Profile>().AsNoTracking()
            .Where(p => reports.Select(r => r.ReporterId).Contains(p.AccountId) || reports.Select(r => r.TargetId).Contains(p.AccountId))
            .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        var waiting = reports.Select(r => new AttentionRow("report", r.Reason.ToString(), r.CreatedAt,
                $"{names.GetValueOrDefault(r.ReporterId, "?")} → {names.GetValueOrDefault(r.TargetId, "?")}", $"/reports/{r.Id}"))
            .Concat(stuck.Select(s => new AttentionRow("payment", s.Note ?? "Paid, not credited", s.PaidAt, s.Name, $"/payments/{s.Id}")))
            .Concat(deletions.Where(d => d.BurnsAt <= clock.UtcNow.AddDays(3))
                .Select(d => new AttentionRow("deletion", $"Fades on {d.BurnsAt:MMM d}", d.AskedAt, d.Name, $"/users/{d.AccountId}")))
            .OrderBy(r => r.Since).ToList();
        return new DashboardView(active, active - lastWeek, bonds, money, storeToday, web, reports.Count, stuck.Count, deletions.Count, waiting);
    }

    public async Task<IReadOnlyList<DeletionRow>> DeletionsAsync(CancellationToken ct = default)
    {
        var days = config.Int(ConfigKeys.AccountDeleteDays);
        var rows = await (from a in db.Set<Account>().AsNoTracking()
                          where a.DeleteAt != null
                          join p in db.Set<Profile.Profile>() on a.Id equals p.AccountId into pj
                          from p in pj.DefaultIfEmpty()
                          orderby a.DeleteAt
                          select new { a.Id, Name = p != null ? p.Name : a.Phone.Substring(0, 4) + "····", a.DeleteAt,
                              Portraits = db.Set<Photos.Photo>().Count(x => x.AccountId == a.Id) }).ToListAsync(ct);
        return [.. rows.Select(r => new DeletionRow(r.Id, r.Name, r.DeleteAt!.Value.AddDays(-days), r.DeleteAt!.Value, r.Portraits))];
    }

    public async Task<HealthView> HealthAsync(CancellationToken ct = default)
    {
        var version = typeof(StatsTables).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";
        var size = await db.Database.SqlQueryRaw<long>("SELECT pg_database_size(current_database()) AS \"Value\"").SingleAsync(ct);
        var watched = await db.Set<Invoice>().CountAsync(i => i.State == InvoiceState.Open || i.WatchUntil > clock.UtcNow, ct);
        DateTimeOffset? backup = null;
        if (settings["Ops:BackupDir"] is { Length: > 0 } dir && Directory.Exists(dir))
            backup = new DirectoryInfo(dir).EnumerateFiles().OrderByDescending(f => f.LastWriteTimeUtc).Select(f => (DateTimeOffset?)f.LastWriteTimeUtc).FirstOrDefault();
        var checks = new List<HealthCheck>
        {
            await ReachAsync("QPay", settings["QPay:Fake"] == "True" || settings["QPay:Fake"] == "true" ? null : (settings["QPay:BaseUrl"] ?? "https://merchant.qpay.mn/v2"), ct),
            await ReachAsync("RevenueCat", settings["RevenueCat:Fake"] == "True" || settings["RevenueCat:Fake"] == "true" ? null : "https://api.revenuecat.com", ct),
            await ReachAsync("Agora", "https://api.agora.io", ct),
            await ReachAsync("verify.mn", settings["VerifyMn:Fake"] == "True" || settings["VerifyMn:Fake"] == "true" ? null : (settings["VerifyMn:BaseUrl"] ?? "https://api.verify.mn"), ct),
        };
        return new HealthView(version, ops.StartedAt, size, backup, pushQueue.Reader.Count, ops.DailySweepAt, ops.PaymentSweepAt, watched,
            ops.StatsRolledAt, checks);
    }

    /// Any answer at all within three seconds counts as reachable; a fake provider is said to be one.
    private async Task<HealthCheck> ReachAsync(string name, string? url, CancellationToken ct)
    {
        if (url is null) return new HealthCheck(name, "ok", "the fake (Development)");
        if (env.IsEnvironment("Testing")) return new HealthCheck(name, "unknown", "not asked from the test host");
        try
        {
            using var c = http.CreateClient();
            c.Timeout = TimeSpan.FromSeconds(3);
            var watch = System.Diagnostics.Stopwatch.StartNew();
            using var res = await c.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            return new HealthCheck(name, "ok", $"{watch.ElapsedMilliseconds} ms");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            return new HealthCheck(name, "down", e is TaskCanceledException ? "no answer in 3 s" : e.Message);
        }
    }
}

/// When the background loops last finished — what the engine room shows. Singleton, in memory.
public sealed class OpsClock
{
    public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DailySweepAt { get; set; }
    public DateTimeOffset? PaymentSweepAt { get; set; }
    public DateTimeOffset? StatsRolledAt { get; set; }
}
