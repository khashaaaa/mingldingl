using MinglDingl.Engine.Kernel.Clock;

namespace MinglDingl.Engine.Features.Festivals;

/// Snow on the World Floor: from the winter solstice (the first of the Nine Nines, Есөн ес) to
/// January 20, both Ulaanbaatar days inclusive.
public static class Winter
{
    public static bool Snows(DateOnly today) =>
        today >= Solstice(today.Year) || today <= new DateOnly(today.Year, 1, 20);

    /// The Ulaanbaatar day of the December solstice (Meeus, Astronomical Algorithms ch. 27; good
    /// to minutes for 2000–3000, far inside a day's margin).
    public static DateOnly Solstice(int year)
    {
        var y = (year - 2000) / 1000.0;
        var jde0 = 2451900.05952 + 365242.74049 * y - 0.06223 * y * y - 0.00823 * y * y * y + 0.00032 * y * y * y * y;
        var t = (jde0 - 2451545.0) / 36525;
        var w = Rad(35999.373 * t - 2.47);
        var dl = 1 + 0.0334 * Math.Cos(w) + 0.0007 * Math.Cos(2 * w);
        var s = Terms.Sum(p => p.A * Math.Cos(Rad(p.B + p.C * t)));
        var jde = jde0 + 0.00001 * s / dl;
        // Julian day 2440587.5 is the Unix epoch; terrestrial time runs ~69 s ahead of UTC.
        var utc = DateTimeOffset.UnixEpoch.AddDays(jde - 2440587.5).AddSeconds(-69);
        return UbDays.DayOf(utc);
    }

    private static double Rad(double deg) => deg * Math.PI / 180;

    private static readonly (double A, double B, double C)[] Terms =
    [
        (485, 324.96, 1934.136), (203, 337.23, 32964.467), (199, 342.08, 20.186), (182, 27.85, 445267.112),
        (156, 73.14, 45036.886), (136, 171.52, 22518.443), (77, 222.54, 65928.934), (74, 296.72, 3034.906),
        (70, 243.58, 9037.513), (58, 119.81, 33718.147), (52, 297.17, 150.678), (50, 21.02, 2281.226),
        (45, 247.54, 29929.562), (44, 325.15, 31555.956), (29, 60.93, 4443.417), (18, 155.12, 67555.328),
        (17, 288.79, 4562.452), (16, 198.04, 62894.029), (14, 199.76, 31436.921), (12, 95.39, 14577.848),
        (12, 287.11, 31931.756), (12, 320.81, 34777.259), (9, 227.73, 1222.114), (8, 15.45, 16859.074),
    ];
}
