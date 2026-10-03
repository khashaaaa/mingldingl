/// <summary>A festival window and the honour a kept encounter inside it earns.</summary>
public record Season(string Id, DateTime StartsOn, DateTime EndsOn, string HonourId);

/// <summary>
/// Festival seasons. Naadam sits on the same days every year, so it is a month-day window; the
/// White Moon follows the lunar calendar and moves every year, so its windows are a table — the
/// same one the app paints its festival look from (<c>mingldingl_app/lib/festivals.ts</c>) — and
/// an admin can override a year by hand. Days are UTC days, like every other "today" in the engine.
/// </summary>
public class SeasonService
{
    private readonly ConfigService _config;

    public SeasonService(ConfigService config) { _config = config; }

    public Season? At(DateTime utc)
    {
        if (!_config.GetBool("season.enabled", true)) return null;
        var day = utc.Date;
        return Naadam(day.Year) is { } naadam && Contains(naadam, day) ? naadam
            : WhiteMoons().FirstOrDefault(moon => Contains(moon, day));
    }

    public Season? Current() => At(DateTime.UtcNow);

    private static bool Contains(Season s, DateTime day) => day >= s.StartsOn && day <= s.EndsOn;

    private Season? Naadam(int year)
    {
        var start = FromMonthDay(year, (int)_config.GetNumber("season.naadam.start_mmdd", 711));
        var end = FromMonthDay(year, (int)_config.GetNumber("season.naadam.end_mmdd", 713));
        return start is null || end is null || end < start ? null : new Season("naadam", start.Value, end.Value, "title_naadam");
    }

    /// <summary>Tsagaan Sar's three days, year by year. Keep in step with the app's FESTIVALS table.</summary>
    private static readonly (int Start, int End)[] WhiteMoonCalendar =
    [
        (20270206, 20270208),
        (20280224, 20280226),
        (20290213, 20290215),
    ];

    private IEnumerable<Season> WhiteMoons()
    {
        var start = FromYmd((int)_config.GetNumber("season.whitemoon.start_yyyymmdd", 0));
        var end = FromYmd((int)_config.GetNumber("season.whitemoon.end_yyyymmdd", 0));
        if (start is not null && end is not null && end >= start)
            yield return new Season("whitemoon", start.Value, end.Value, "title_whitemoon");
        foreach (var (s, e) in WhiteMoonCalendar)
            if (FromYmd(s) is DateTime from && FromYmd(e) is DateTime to)
                yield return new Season("whitemoon", from, to, "title_whitemoon");
    }

    private static DateTime? FromMonthDay(int year, int mmdd) => SafeDate(year, mmdd / 100, mmdd % 100);

    private static DateTime? FromYmd(int ymd) => ymd <= 0 ? null : SafeDate(ymd / 10000, ymd / 100 % 100, ymd % 100);

    private static DateTime? SafeDate(int y, int m, int d) =>
        y is >= 2000 and <= 9999 && m is >= 1 and <= 12 && d >= 1 && d <= DateTime.DaysInMonth(y, m)
            ? new DateTime(y, m, d, 0, 0, 0, DateTimeKind.Utc)
            : null;
}
