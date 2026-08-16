// Static reference data + geometry for location-based matching (Discover
// distance sort, GPS-detected city on onboarding). Snapping to a known list
// of Mongolia's 21 aimag (province) capitals + Ulaanbaatar's ~9 districts is
// far more reliable here than raw reverse-geocoding: no external service
// dependency, no quota/cost, and it degrades gracefully in rural areas with
// no formal street-level address data.
//
// Coordinates are approximate town/district centers, not survey-precise —
// fine for "which of ~30 known places is nearest", not intended for anything
// requiring sub-km accuracy. The actual Discover distance sort uses each
// user's raw GPS coordinates, not these snapped points, so an imprecise
// label here never affects match ranking, only the display city name.
public static class MongoliaGeo
{
    public record CityPoint(string Name, double Latitude, double Longitude);

    // Split so the fallback picker (GeoController.GetCities) can show
    // Ulaanbaatar as one top-level entry and only reveal its districts once
    // that's picked, instead of one flat list mixing 21 province capitals
    // with 9 district names a non-UB user has no reason to scroll past.
    // NearestCity (GPS auto-detect) still searches the combined Cities list
    // below — that's matching real physical proximity, not a manual
    // selection, so provinces and districts belong in the same pool there.
    public static readonly IReadOnlyList<CityPoint> Provinces =
    [
        // 21 aimag capitals
        new("Tsetserleg",     47.4767, 101.4571), // Arkhangai
        new("Ölgii",          48.9700,  89.9500), // Bayan-Ölgii
        new("Bayankhongor",   46.1928, 100.7181), // Bayankhongor
        new("Bulgan",         48.8125, 103.5347), // Bulgan
        new("Darkhan",        49.4867, 105.9228), // Darkhan-Uul
        new("Choibalsan",     48.0783, 114.5344), // Dornod
        new("Sainshand",      44.8917, 110.1333), // Dornogovi
        new("Mandalgovi",     45.7667, 106.2708), // Dundgovi
        new("Altai",          46.3722,  96.2583), // Govi-Altai
        new("Choir",          46.3611, 108.3547), // Govisümber
        new("Chinggis",       47.3250, 110.6556), // Khentii (formerly Öndörkhaan)
        new("Khovd",          48.0056,  91.6419), // Khovd
        new("Mörön",          49.6342, 100.1625), // Khövsgöl
        new("Dalanzadgad",    43.5708, 104.4258), // Ömnögovi
        new("Erdenet",        49.0333, 104.0833), // Orkhon
        new("Arvaikheer",     46.2647, 102.7778), // Övörkhangai
        new("Sükhbaatar",     50.2333, 106.2000), // Selenge (town, distinct from UB's Sükhbaatar district)
        new("Baruun-Urt",     46.6806, 113.2792), // Sükhbaatar aimag
        new("Zuunmod",        47.7083, 106.9556), // Töv
        new("Ulaangom",       49.9764,  92.0667), // Uvs
        new("Uliastai",       47.7417,  96.8425), // Zavkhan
    ];

    // Ulaanbaatar districts — most users will likely fall here, so these
    // get their own points rather than one city-wide marker.
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

    public static string NearestCity(double latitude, double longitude) =>
        Cities
            .OrderBy(c => DistanceKm(latitude, longitude, c.Latitude, c.Longitude))
            .First()
            .Name;

    // Haversine great-circle distance in kilometers. Deliberately plain C#
    // math (sin/cos/atan2), not translatable to SQL by EF Core — callers that
    // need this over a queryable set must materialize candidates first (see
    // MatchesController.GetCandidates), which is fine at this app's scale.
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

    // Shared by GeoController.GetNearestCity and UsersController.UpdateLocation,
    // which both validated this identically by hand before being consolidated
    // here — standard WGS84 bounds, nothing Mongolia-specific about the check
    // itself, it just lives alongside the rest of this app's geo code.
    public static bool IsValidCoordinate(double latitude, double longitude) =>
        latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;
}
