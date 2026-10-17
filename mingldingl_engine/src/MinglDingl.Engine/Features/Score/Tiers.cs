using MinglDingl.Engine.Kernel.Config;

namespace MinglDingl.Engine.Features.Score;

/// The gem ladder. Thresholds are admin config, strictly increasing.
public static class Tiers
{
    public static readonly IReadOnlyList<string> Names = ["Garnet", "Opal", "Amethyst", "Sapphire", "Ruby", "Emerald"];

    public static int[] Thresholds(IConfig config) =>
        [0, .. ConfigKeys.TierLadder.Select(config.Int)];

    public static string For(int points, IConfig config)
    {
        var t = Thresholds(config);
        var i = t.Length - 1;
        while (i > 0 && points < t[i]) i--;
        return Names[i];
    }

    public static int Index(string tier) => Math.Max(0, Names.ToList().IndexOf(tier));

    /// Summons a day: base + one per N points + the tier index, capped at cap + the tier index.
    /// The Yard's base and cap unless a floor's are given.
    public static int Candles(int points, int tierIndex, IConfig config, int? @base = null, int? cap = null) =>
        Math.Min((@base ?? config.Int(ConfigKeys.CandlesBase)) + points / config.Int(ConfigKeys.CandlesPerPoints) + tierIndex,
            (cap ?? config.Int(ConfigKeys.CandlesCap)) + tierIndex);
}
