using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Features.Stats;

/// One day's count of one metric among the people who share these dimensions. Written by the
/// rollup; today is never stored (it is counted live). City, gender and age band are the person's
/// at the event; tier and floor are theirs when the day was rolled up.
public sealed class StatDay
{
    public DateOnly Day { get; set; }
    public string Metric { get; set; } = "";
    public string City { get; set; } = "";
    public string Gender { get; set; } = "";
    public string AgeBand { get; set; } = "";
    public string Tier { get; set; } = "";
    public string Floor { get; set; } = "";
    public long Count { get; set; }
    /// Money metrics: tögrög. Others: equal to Count.
    public long Sum { get; set; }
}

internal sealed class StatDayMap : IEntityTypeConfiguration<StatDay>
{
    public void Configure(EntityTypeBuilder<StatDay> e)
    {
        e.ToTable("stats_daily");
        e.HasKey(x => new { x.Day, x.Metric, x.City, x.Gender, x.AgeBand, x.Tier, x.Floor });
        e.Property(x => x.Metric).HasMaxLength(32);
        e.Property(x => x.City).HasMaxLength(40);
        e.Property(x => x.Gender).HasMaxLength(10);
        e.Property(x => x.AgeBand).HasMaxLength(8);
        e.Property(x => x.Tier).HasMaxLength(12);
        e.Property(x => x.Floor).HasMaxLength(10);
        e.HasIndex(x => new { x.Metric, x.Day });
    }
}

/// The filters every statistics read takes; null is "all".
public sealed record StatFilter(string? City, string? Gender, string? AgeBand, string? Tier, string? Floor);

public sealed record StatPoint(DateOnly Day, long Count, long Sum);

/// One metric over the range: its days (every day, zeros included) and totals.
public sealed record StatSeries(string Metric, IReadOnlyList<StatPoint> Days, long Count, long Sum);

public sealed record StatsView(DateOnly From, DateOnly To, IReadOnlyList<StatSeries> Series);

/// A group's own table: its heading row and rows of text cells.
public sealed record StatTable(IReadOnlyList<string> Head, IReadOnlyList<IReadOnlyList<string>> Rows);

/// The dashboard's "today", live: who came back, bonds made, money in and what waits on a keeper.
public sealed record DashboardView(long ActiveToday, long ActiveDelta, long BondsToday, long MoneyToday, int StorePurchasesToday,
    int WebPaymentsToday, int OpenReports, int StuckPayments, int Deletions, IReadOnlyList<AttentionRow> Waiting);

/// kind: report / payment / deletion. link: the admin page that settles it.
public sealed record AttentionRow(string Kind, string About, DateTimeOffset Since, string Who, string Link);

public sealed record DeletionRow(Guid AccountId, string Name, DateTimeOffset AskedAt, DateTimeOffset BurnsAt, int Portraits);

/// state: ok / down / unknown, with a short note.
public sealed record HealthCheck(string Name, string State, string Note);

public sealed record HealthView(string Version, DateTimeOffset StartedAt, long DatabaseBytes, DateTimeOffset? LastBackupAt,
    int PushQueue, DateTimeOffset? DailySweepAt, DateTimeOffset? PaymentSweepAt, int InvoicesWatched, DateTimeOffset? StatsRolledAt,
    IReadOnlyList<HealthCheck> Checks);
