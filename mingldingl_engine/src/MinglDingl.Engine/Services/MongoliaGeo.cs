public static class MongoliaGeo
{
    public record CityPoint(string Name, double Latitude, double Longitude);

    public static readonly IReadOnlyList<CityPoint> Provinces =
    [
        new("Tsetserleg",     47.4767, 101.4571),
        new("Ölgii",          48.9700,  89.9500),
        new("Bayankhongor",   46.1928, 100.7181),
        new("Bulgan",         48.8125, 103.5347),
        new("Darkhan",        49.4867, 105.9228),
        new("Choibalsan",     48.0783, 114.5344),
        new("Sainshand",      44.8917, 110.1333),
        new("Mandalgovi",     45.7667, 106.2708),
        new("Altai",          46.3722,  96.2583),
        new("Choir",          46.3611, 108.3547),
        new("Chinggis",       47.3250, 110.6556),
        new("Khovd",          48.0056,  91.6419),
        new("Mörön",          49.6342, 100.1625),
        new("Dalanzadgad",    43.5708, 104.4258),
        new("Erdenet",        49.0333, 104.0833),
        new("Arvaikheer",     46.2647, 102.7778),
        new("Sükhbaatar",     50.2333, 106.2000),
        new("Baruun-Urt",     46.6806, 113.2792),
        new("Zuunmod",        47.7083, 106.9556),
        new("Ulaangom",       49.9764,  92.0667),
        new("Uliastai",       47.7417,  96.8425),
    ];

    public static readonly IReadOnlyList<CityPoint> UlaanbaatarDistricts =
    [
        new("Bayangol",          47.8975, 106.8794),
        new("Bayanzürkh",        47.9128, 106.9522),
        new("Chingeltei",        47.9328, 106.8892),
        new("Khan-Uul",          47.8697, 106.8794),
        new("Nalaikh",           47.7472, 107.2564),
        new("Songino Khairkhan", 47.9233, 106.7686),
        new("Sükhbaatar (UB)",   47.9184, 106.9153),
        new("Bagakhangai",       47.6244, 107.5794),
        new("Baganuur",          47.7833, 108.2833),
    ];

    public static readonly IReadOnlyList<CityPoint> Cities = [.. Provinces, .. UlaanbaatarDistricts];

    /// <summary>
    /// Every city label a profile may carry. This is deliberately wider than <see cref="Cities"/>,
    /// which exists to answer "which point is nearest" and therefore lists Ulaanbaatar as its nine
    /// districts rather than as itself. Onboarding writes the capital's own name, so it has to be
    /// accepted here or a perfectly ordinary Ulaanbaatar profile is rejected.
    /// </summary>
    public const string Capital = "Ulaanbaatar";

    public static readonly IReadOnlySet<string> AcceptedCityNames =
        new HashSet<string>(Cities.Select(c => c.Name).Append(Capital), StringComparer.Ordinal);

    // The capital's nine districts plus its own name. NearestCity resolves an Ulaanbaatar
    // coordinate to whichever district is closest, and the district picker lets a profile carry a
    // district too — so these are the City values that all mean "Ulaanbaatar" for grouping.
    private static readonly IReadOnlySet<string> UlaanbaatarNames =
        new HashSet<string>(UlaanbaatarDistricts.Select(d => d.Name).Append(Capital), StringComparer.Ordinal);

    /// <summary>
    /// The city a leaderboard groups under: every Ulaanbaatar district collapses to the capital so
    /// the city of ~1.6M shares one board instead of nine near-empty ones; every province stands
    /// for itself. Null or empty stays empty.
    /// </summary>
    public static string CanonicalCity(string? city) =>
        city is not null && UlaanbaatarNames.Contains(city) ? Capital : city ?? string.Empty;

    /// <summary>
    /// Every stored City value that shares <paramref name="city"/>'s leaderboard cohort, for a
    /// `City IN (...)` filter: the capital's cohort is all nine districts plus "Ulaanbaatar"; a
    /// province's cohort is itself alone.
    /// </summary>
    public static IReadOnlyList<string> CohortCityNames(string? city) =>
        CanonicalCity(city) == Capital ? UlaanbaatarNames.ToList() : [city ?? string.Empty];

    public static string NearestCity(double latitude, double longitude) =>
        Cities
            .OrderBy(c => DistanceKm(latitude, longitude, c.Latitude, c.Longitude))
            .First()
            .Name;

    public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371.0;
        double dLat = ToRadians(lat2 - lat1);
        double dLon = ToRadians(lon2 - lon1);
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    public static bool IsValidCoordinate(double latitude, double longitude) =>
        latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;
}
