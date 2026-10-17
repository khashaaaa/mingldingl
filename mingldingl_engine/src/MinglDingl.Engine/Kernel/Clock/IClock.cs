namespace MinglDingl.Engine.Kernel.Clock;

public interface IClock
{
    DateTimeOffset UtcNow { get; }

    /// The calendar day in Ulaanbaatar — what "today" means to every person using the app.
    DateOnly TodayUb { get; }
}

public sealed class SystemClock(Func<DateTimeOffset> now) : IClock
{
    private static readonly TimeZoneInfo Ub = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ulaanbaatar");

    public SystemClock() : this(() => DateTimeOffset.UtcNow) { }

    public DateTimeOffset UtcNow => now();
    public DateOnly TodayUb => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now(), Ub).DateTime);
}

/// Ulaanbaatar days as instants (UTC+8 all year; Mongolia keeps no summer time since 2017).
public static class UbDays
{
    private static readonly TimeSpan Offset = TimeSpan.FromHours(8);

    public static DateTimeOffset Start(DateOnly day) => new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), Offset).ToUniversalTime();

    public static DateOnly DayOf(DateTimeOffset at) => DateOnly.FromDateTime(at.ToOffset(Offset).DateTime);

    /// The Monday that starts the week holding `day` (weeks run Monday–Sunday).
    public static DateOnly WeekStart(DateOnly day) => day.AddDays(-(((int)day.DayOfWeek + 6) % 7));
}
