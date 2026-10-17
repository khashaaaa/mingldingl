namespace MinglDingl.Engine.Features.Profile;

public sealed record City(string Name, string Kind, string Region, double Lat, double Lng);

/// The places a profile may name: the capital, its nine districts, and the 21 province centres,
/// each with the province it belongs to (the picker groups and labels by it).
public static class MongoliaGeo
{
    public const string Capital = "Ulaanbaatar";

    public static readonly IReadOnlyList<City> All =
    [
        new(Capital, "capital", Capital, 47.9184, 106.9177),
        new("Bayangol", "district", Capital, 47.8975, 106.8794),
        new("Bayanzürkh", "district", Capital, 47.9128, 106.9522),
        new("Chingeltei", "district", Capital, 47.9328, 106.8892),
        new("Khan-Uul", "district", Capital, 47.8697, 106.8794),
        new("Nalaikh", "district", Capital, 47.7472, 107.2564),
        new("Songino Khairkhan", "district", Capital, 47.9233, 106.7686),
        new("Sükhbaatar (UB)", "district", Capital, 47.9184, 106.9153),
        new("Bagakhangai", "district", Capital, 47.6244, 107.5794),
        new("Baganuur", "district", Capital, 47.7833, 108.2833),
        new("Tsetserleg", "province", "Arkhangai", 47.4767, 101.4571),
        new("Ölgii", "province", "Bayan-Ölgii", 48.9700, 89.9500),
        new("Bayankhongor", "province", "Bayankhongor", 46.1928, 100.7181),
        new("Bulgan", "province", "Bulgan", 48.8125, 103.5347),
        new("Darkhan", "province", "Darkhan-Uul", 49.4867, 105.9228),
        new("Choibalsan", "province", "Dornod", 48.0783, 114.5344),
        new("Sainshand", "province", "Dornogovi", 44.8917, 110.1333),
        new("Mandalgovi", "province", "Dundgovi", 45.7667, 106.2708),
        new("Altai", "province", "Govi-Altai", 46.3722, 96.2583),
        new("Choir", "province", "Govisümber", 46.3611, 108.3547),
        new("Chinggis", "province", "Khentii", 47.3250, 110.6556),
        new("Khovd", "province", "Khovd", 48.0056, 91.6419),
        new("Mörön", "province", "Khövsgöl", 49.6342, 100.1625),
        new("Dalanzadgad", "province", "Ömnögovi", 43.5708, 104.4258),
        new("Erdenet", "province", "Orkhon", 49.0333, 104.0833),
        new("Arvaikheer", "province", "Övörkhangai", 46.2647, 102.7778),
        new("Sükhbaatar", "province", "Selenge", 50.2333, 106.2000),
        new("Baruun-Urt", "province", "Sükhbaatar", 46.6806, 113.2792),
        new("Zuunmod", "province", "Töv", 47.7083, 106.9556),
        new("Ulaangom", "province", "Uvs", 49.9764, 92.0667),
        new("Uliastai", "province", "Zavkhan", 47.7417, 96.8425),
    ];

    private static readonly IReadOnlySet<string> Names = All.Select(c => c.Name).ToHashSet(StringComparer.Ordinal);

    public static bool IsKnown(string? name) => name is not null && Names.Contains(name);
}
