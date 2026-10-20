using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using Npgsql;

namespace MinglDingl.Engine.Features.Stats;

/// The keepers' numbers. Every metric is one SQL source of events — when, whose, how much — and the
/// rollup counts each finished Ulaanbaatar day once into stats_daily by the filter dimensions.
/// Reads add today, counted live from the same source. Nothing heavy runs on a request.
public sealed class StatsService(AppDb db, IClock clock)
{
    /// Every metric's events. Sources are fixed text (never input): (at, account, amount).
    public static readonly IReadOnlyDictionary<string, string> Sources = new Dictionary<string, string>
    {
        ["signups"] = """SELECT "CreatedAt" AS at, "Id" AS account, 1 AS amount FROM accounts""",
        ["finished"] = """SELECT "WelcomedAt" AS at, "AccountId" AS account, 1 AS amount FROM profiles WHERE "WelcomedAt" IS NOT NULL""",
        ["allies"] = """SELECT "CreatedAt" AS at, "Id" AS account, 1 AS amount FROM accounts WHERE "CalledBy" IS NOT NULL""",
        ["active"] = """SELECT "CreatedAt" AS at, "AccountId" AS account, 1 AS amount FROM score_events WHERE "Kind" = 'dawn'""",
        ["seventhDawn"] = """SELECT "CreatedAt" AS at, "AccountId" AS account, 1 AS amount FROM score_events WHERE "Kind" = 'seventhDawn'""",
        ["quests"] = """SELECT "ClaimedAt" AS at, "AccountId" AS account, 1 AS amount FROM quest_claims""",
        ["chests"] = """SELECT "OpenedAt" AS at, "AccountId" AS account, 1 AS amount FROM chests WHERE "OpenedAt" IS NOT NULL""",
        ["summons"] = """SELECT "CreatedAt" AS at, "SummonerId" AS account, 1 AS amount FROM bonds WHERE "Origin" = 'seek'""",
        ["bonds"] = """SELECT "CreatedAt" AS at, "AId" AS account, 1 AS amount FROM bonds""",
        ["bondsSeek"] = """SELECT "CreatedAt" AS at, "AId" AS account, 1 AS amount FROM bonds WHERE "Origin" = 'seek'""",
        ["bondsThread"] = """SELECT "CreatedAt" AS at, "AId" AS account, 1 AS amount FROM bonds WHERE "Origin" = 'thread'""",
        ["bondsSquare"] = """SELECT "CreatedAt" AS at, "AId" AS account, 1 AS amount FROM bonds WHERE "Origin" = 'square'""",
        ["answered"] = """SELECT b."CreatedAt" AS at, b."SummonerId" AS account, 1 AS amount FROM bonds b WHERE b."Origin" = 'seek' AND (b."LettersA" > 0 AND b."LettersB" > 0)""",
        ["goneCold"] = """SELECT "ClosedAt" AS at, "AId" AS account, 1 AS amount FROM bonds WHERE "State" = 'Cold' AND "ClosedAt" IS NOT NULL""",
        // Counted against the side that was severed, so the filters show who is let go.
        ["severed"] = """SELECT "ClosedAt" AS at, CASE WHEN "ClosedBy" = "AId" THEN "BId" ELSE "AId" END AS account, 1 AS amount FROM bonds WHERE "State" = 'Severed' AND "ClosedAt" IS NOT NULL""",
        ["wanderings"] = """SELECT t."KeptAt" AS at, b."AId" AS account, 1 AS amount FROM wanderings_taken t JOIN bonds b ON b."Id" = t."BondId" WHERE t."KeptAt" IS NOT NULL""",
        ["letters"] = """SELECT "CreatedAt" AS at, "AuthorId" AS account, 1 AS amount FROM letters""",
        ["seal1"] = """SELECT "CreatedAt" AS at, "AuthorId" AS account, 1 AS amount FROM letters WHERE "SealBroken" = 1""",
        ["seal4"] = """SELECT "CreatedAt" AS at, "AuthorId" AS account, 1 AS amount FROM letters WHERE "SealBroken" = 4""",
        ["icebreakers"] = """SELECT e."IcebreakerRevealedAt" AS at, b."AId" AS account, 1 AS amount FROM encounters e JOIN bonds b ON b."Id" = e."BondId" WHERE e."IcebreakerRevealedAt" IS NOT NULL""",
        ["trials"] = """SELECT e."TrialDoneAt" AS at, b."AId" AS account, 1 AS amount FROM encounters e JOIN bonds b ON b."Id" = e."BondId" WHERE e."TrialDoneAt" IS NOT NULL""",
        ["rites"] = """SELECT e."RiteDoneAt" AS at, b."AId" AS account, 1 AS amount FROM encounters e JOIN bonds b ON b."Id" = e."BondId" WHERE e."RiteDoneAt" IS NOT NULL""",
        ["sworn"] = """SELECT m."SwornAt" AS at, b."AId" AS account, 1 AS amount FROM meetings m JOIN bonds b ON b."Id" = m."BondId" WHERE m."SwornAt" IS NOT NULL""",
        ["kept"] = """SELECT m."ClosedAt" AS at, b."AId" AS account, 1 AS amount FROM meetings m JOIN bonds b ON b."Id" = m."BondId" WHERE m."Outcome" = 'Kept' AND m."ClosedAt" IS NOT NULL""",
        ["noShows"] = """SELECT "ClosedAt" AS at, "NoShowOf" AS account, 1 AS amount FROM meetings WHERE "Outcome" = 'NoShow' AND "ClosedAt" IS NOT NULL""",
        ["oaths"] = """SELECT "CreatedAt" AS at, "AccountId" AS account, 1 AS amount FROM score_events WHERE "Kind" = 'oathProven'""",
        ["threadsWoven"] = """SELECT "WovenAt" AS at, "WeaverId" AS account, 1 AS amount FROM threads""",
        ["threadsSparked"] = """SELECT "ClosedAt" AS at, "WeaverId" AS account, 1 AS amount FROM threads WHERE "State" = 'Sparked' AND "ClosedAt" IS NOT NULL""",
        ["seats"] = """SELECT "TakenAt" AS at, "AccountId" AS account, 1 AS amount FROM square_seats""",
        ["squareSat"] = """SELECT "JoinedAt" AS at, "AccountId" AS account, 1 AS amount FROM square_seats WHERE "JoinedAt" IS NOT NULL""",
        ["revenue"] = """SELECT p."PaidAt" AS at, i."AccountId" AS account, p."Amount" AS amount FROM payments p JOIN invoices i ON i."Id" = p."InvoiceId" WHERE p."State" = 'Credited'""",
        ["refunds"] = """SELECT p."SettledAt" AS at, i."AccountId" AS account, p."Amount" AS amount FROM payments p JOIN invoices i ON i."Id" = p."InvoiceId" WHERE p."State" = 'Refunded' AND p."SettledAt" IS NOT NULL""",
        ["webPayments"] = """SELECT p."PaidAt" AS at, i."AccountId" AS account, 1 AS amount FROM payments p JOIN invoices i ON i."Id" = p."InvoiceId" WHERE p."State" = 'Credited'""",
        ["storeStarts"] = """SELECT "StartsAt" AS at, "AccountId" AS account, 1 AS amount FROM membership_grants WHERE "Source" = 'Store'""",
        ["newMembers"] = """SELECT min("StartsAt") AS at, "AccountId" AS account, 1 AS amount FROM membership_grants WHERE "RevokedAt" IS NULL GROUP BY "AccountId" """,
    };

    /// The rolled-up dimensions of an event: its person's city, gender and age band then, tier and floor now.
    private const string Dims = """
        COALESCE(p."City", '') AS city, COALESCE(p."Gender", '') AS gender,
        CASE WHEN p."BirthDate" IS NULL THEN ''
             WHEN date_part('year', age(e.at::date, p."BirthDate")) < 25 THEN '18-24'
             WHEN date_part('year', age(e.at::date, p."BirthDate")) < 35 THEN '25-34'
             WHEN date_part('year', age(e.at::date, p."BirthDate")) < 45 THEN '35-44'
             ELSE '45+' END AS band,
        COALESCE(p."Tier", '') AS tier,
        COALESCE((SELECT max(CASE g."Floor" WHEN 'HighTable' THEN 'highTable' WHEN 'Hall' THEN 'hall' END)
                  FROM membership_grants g WHERE g."AccountId" = e.account AND g."RevokedAt" IS NULL
                    AND g."StartsAt" <= now() AND g."EndsAt" > now()), 'yard') AS floor
        """;

    private static string Grouped(string metric) => $"""
        SELECT {Dims}, count(*)::bigint AS n, COALESCE(sum(e.amount), 0)::bigint AS s
        FROM ({Sources[metric]}) e LEFT JOIN profiles p ON p."AccountId" = e.account
        WHERE e.at >= @from AND e.at < @to
        GROUP BY 1, 2, 3, 4, 5
        """;

    /// Counts one finished day of every metric into stats_daily, replacing what was there.
    public async Task RollUpAsync(DateOnly day, CancellationToken ct = default)
    {
        var (from, to) = (UbDays.Start(day), UbDays.Start(day.AddDays(1)));
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Set<StatDay>().Where(s => s.Day == day).ExecuteDeleteAsync(ct);
        foreach (var metric in Sources.Keys)
        {
            // Only our own SQL is spliced in (Sources); every value is a parameter.
            var sql = $"""
                INSERT INTO stats_daily ("Day", "Metric", "City", "Gender", "AgeBand", "Tier", "Floor", "Count", "Sum")
                SELECT @day, @metric, city, gender, band, tier, floor, n, s FROM ({Grouped(metric)}) x
                """;
            await db.Database.ExecuteSqlRawAsync(sql, [new NpgsqlParameter("day", day), new NpgsqlParameter("metric", metric),
                    new NpgsqlParameter("from", from), new NpgsqlParameter("to", to)], ct);
        }
        await tx.CommitAsync(ct);
    }

    /// Rolls up every finished day not yet counted (and always yesterday again, for late events).
    public async Task<int> CatchUpAsync(CancellationToken ct = default)
    {
        var yesterday = clock.TodayUb.AddDays(-1);
        var last = await db.Set<StatDay>().MaxAsync(s => (DateOnly?)s.Day, ct);
        var first = await db.Set<Account>().MinAsync(a => (DateTimeOffset?)a.CreatedAt, ct) is { } born ? UbDays.DayOf(born) : yesterday;
        var start = last is { } l ? (l < yesterday ? l : yesterday) : first;
        if (start < yesterday.AddDays(-400)) start = yesterday.AddDays(-400);
        var n = 0;
        for (var d = start; d <= yesterday; d = d.AddDays(1), n++) await RollUpAsync(d, ct);
        return n;
    }

    public async Task<StatsView> SeriesAsync(IReadOnlyList<string> metrics, DateOnly from, DateOnly to, StatFilter f,
        CancellationToken ct = default)
    {
        if (to < from) throw new DomainException(400, "stats.range", "The range ends before it starts");
        if (to.DayNumber - from.DayNumber > 400) throw new DomainException(400, "stats.range", "At most 400 days at once");
        var unknown = metrics.FirstOrDefault(m => !Sources.ContainsKey(m));
        if (unknown is not null) throw new DomainException(400, "stats.metric", $"No metric {unknown}");
        var today = clock.TodayUb;
        var q = db.Set<StatDay>().AsNoTracking().Where(s => metrics.Contains(s.Metric) && s.Day >= from && s.Day <= to && s.Day < today);
        if (f.City is { } c) q = q.Where(s => s.City == c);
        if (f.Gender is { } g) q = q.Where(s => s.Gender == g);
        if (f.AgeBand is { } a) q = q.Where(s => s.AgeBand == a);
        if (f.Tier is { } t) q = q.Where(s => s.Tier == t);
        if (f.Floor is { } fl) q = q.Where(s => s.Floor == fl);
        var stored = await q.GroupBy(s => new { s.Metric, s.Day })
            .Select(x => new { x.Key.Metric, x.Key.Day, Count = x.Sum(s => s.Count), Sum = x.Sum(s => s.Sum) }).ToListAsync(ct);
        var points = stored.ToDictionary(x => (x.Metric, x.Day), x => (x.Count, x.Sum));
        if (today >= from && today <= to)
            foreach (var m in metrics)
                points[(m, today)] = await LiveAsync(m, today, f, ct);
        var days = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1).Select(i => from.AddDays(i)).ToList();
        return new StatsView(from, to, [.. metrics.Select(m =>
        {
            var series = days.Select(d => points.TryGetValue((m, d), out var p) ? new StatPoint(d, p.Count, p.Sum) : new StatPoint(d, 0, 0)).ToList();
            return new StatSeries(m, series, series.Sum(p => p.Count), series.Sum(p => p.Sum));
        })]);
    }

    /// Today, counted from the source with the same dimensions and filters.
    private async Task<(long Count, long Sum)> LiveAsync(string metric, DateOnly day, StatFilter f, CancellationToken ct)
    {
        // Only our own SQL is spliced in (Sources); every value is a parameter.
        var sql = $"""
            SELECT COALESCE(sum(n), 0)::bigint AS "Count", COALESCE(sum(s), 0)::bigint AS "Sum" FROM ({Grouped(metric)}) x
            WHERE (@city::text IS NULL OR city = @city) AND (@gender::text IS NULL OR gender = @gender)
              AND (@band::text IS NULL OR band = @band) AND (@tier::text IS NULL OR tier = @tier) AND (@floor::text IS NULL OR floor = @floor)
            """;
        var rows = await db.Database.SqlQueryRaw<LiveRow>(sql,
            new NpgsqlParameter("from", UbDays.Start(day)), new NpgsqlParameter("to", UbDays.Start(day.AddDays(1))),
            Text("city", f.City), Text("gender", f.Gender), Text("band", f.AgeBand), Text("tier", f.Tier), Text("floor", f.Floor))
            .ToListAsync(ct);
        return rows.Count == 0 ? (0, 0) : (rows[0].Count, rows[0].Sum);
    }

    private static NpgsqlParameter Text(string name, string? value) =>
        new(name, NpgsqlTypes.NpgsqlDbType.Text) { Value = (object?)value ?? DBNull.Value };

    private sealed record LiveRow(long Count, long Sum);
}
