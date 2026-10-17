using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Festivals;

public static class FestivalKeys
{
    public const string TsagaanSar = "tsagaanSar";
    public const string Naadam = "naadam";
    public const string DayOfBond = "dayOfBond";
    public const string March8 = "march8";
    public const string LastBell = "lastBell";
    /// The festivals that carry an honour (a kept encounter during one earns it, once a year).
    public static readonly IReadOnlyList<string> WithHonour = [TsagaanSar, Naadam];
}

/// One run of a festival, both days inclusive (Ulaanbaatar days). The admin keeps the calendar
/// (Tsagaan Sar moves with the moon); the engine seeds the known years.
public sealed class Festival
{
    public Guid Id { get; set; }
    public string Key { get; set; } = "";
    public DateOnly Starts { get; set; }
    public DateOnly Ends { get; set; }
}

internal sealed class FestivalMap : IEntityTypeConfiguration<Festival>
{
    public void Configure(EntityTypeBuilder<Festival> e)
    {
        e.ToTable("festivals");
        e.Property(x => x.Key).HasMaxLength(16);
        e.HasIndex(x => new { x.Starts, x.Ends });
    }
}

/// key: which festival; starts/ends: Ulaanbaatar days, inclusive.
public sealed record FestivalView(string Key, DateOnly Starts, DateOnly Ends);

/// now: the festival running today, if any; next: the next one to start; nextHonour: the next one
/// that carries an honour (the Encounter Log's Season line).
public sealed record SeasonView(FestivalView? Now, FestivalView? Next, FestivalView? NextHonour);

public sealed class FestivalService(AppDb db, IClock clock)
{
    public async Task<SeasonView> SeasonAsync(CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        var rows = await db.Set<Festival>().AsNoTracking().Where(f => f.Ends >= today)
            .OrderBy(f => f.Starts).Take(12).ToListAsync(ct);
        var now = rows.FirstOrDefault(f => f.Starts <= today);
        var next = rows.FirstOrDefault(f => f.Starts > today);
        var honour = rows.FirstOrDefault(f => f.Starts > today && FestivalKeys.WithHonour.Contains(f.Key));
        return new SeasonView(now is null ? null : View(now), next is null ? null : View(next),
            honour is null ? null : View(honour));
    }

    /// Every festival run that has started, oldest first (the honours read it).
    public Task<List<Festival>> PastAndCurrentAsync(CancellationToken ct = default)
    {
        var today = clock.TodayUb;
        return db.Set<Festival>().AsNoTracking().Where(f => f.Starts <= today).OrderBy(f => f.Starts).ToListAsync(ct);
    }

    private static FestivalView View(Festival f) => new(f.Key, f.Starts, f.Ends);

    /// The fixed-date festivals for this year and the next two, and Tsagaan Sar where its date is
    /// known (the admin adds later years). Adds only what is missing.
    public static async Task SeedAsync(AppDb db, DateOnly today, CancellationToken ct = default)
    {
        var want = new List<Festival>();
        for (var y = today.Year; y <= today.Year + 2; y++)
        {
            want.Add(Make(FestivalKeys.DayOfBond, new(y, 2, 14), new(y, 2, 14)));
            want.Add(Make(FestivalKeys.March8, new(y, 3, 8), new(y, 3, 8)));
            want.Add(Make(FestivalKeys.Naadam, new(y, 7, 11), new(y, 7, 15)));
            want.Add(Make(FestivalKeys.LastBell, new(y, 12, 30), new(y, 12, 31)));
        }
        // The first three days of the Lunar New Year (Mongolian calendar).
        want.Add(Make(FestivalKeys.TsagaanSar, new(2026, 2, 18), new(2026, 2, 20)));
        want.Add(Make(FestivalKeys.TsagaanSar, new(2027, 2, 7), new(2027, 2, 9)));
        want.Add(Make(FestivalKeys.TsagaanSar, new(2028, 1, 27), new(2028, 1, 29)));

        var have = await db.Set<Festival>().Select(f => new { f.Key, f.Starts.Year }).ToListAsync(ct);
        var missing = want.Where(w => !have.Any(h => h.Key == w.Key && h.Year == w.Starts.Year)).ToList();
        if (missing.Count == 0) return;
        db.AddRange(missing);
        await db.SaveChangesAsync(ct);
    }

    private static Festival Make(string key, DateOnly from, DateOnly to) =>
        new() { Id = Guid.CreateVersion7(), Key = key, Starts = from, Ends = to };
}
