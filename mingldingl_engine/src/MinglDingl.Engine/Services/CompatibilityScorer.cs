public static class CompatibilityScorer
{
    private static readonly IReadOnlyDictionary<string, int> HabitLevels =
        new Dictionary<string, int> { ["Never"] = 0, ["Occasionally"] = 1, ["Regularly"] = 2 };

    private static readonly IReadOnlyDictionary<string, int> LifestyleLevels =
        new Dictionary<string, int> { ["Relaxed"] = 0, ["Balanced"] = 1, ["Active"] = 2 };

    public static double? Score(User a, User b)
    {
        double total = 0;
        int count = 0;

        if (a.HasKids.HasValue && b.HasKids.HasValue)
        {
            total += a.HasKids == b.HasKids ? 1 : 0;
            count++;
        }

        AddOrdinal(a.SmokingHabit, b.SmokingHabit, HabitLevels, ref total, ref count);
        AddOrdinal(a.DrinkingHabit, b.DrinkingHabit, HabitLevels, ref total, ref count);
        AddOrdinal(a.Lifestyle, b.Lifestyle, LifestyleLevels, ref total, ref count);

        if (a.Religion != null && b.Religion != null)
        {
            total += a.Religion == b.Religion ? 1 : 0;
            count++;
        }

        return count == 0 ? null : total / count;
    }

    private static void AddOrdinal(string? x, string? y, IReadOnlyDictionary<string, int> levels, ref double total, ref int count)
    {
        if (x is null || y is null || !levels.TryGetValue(x, out var lx) || !levels.TryGetValue(y, out var ly)) return;

        int maxDiff = levels.Values.Max() - levels.Values.Min();
        total += 1 - (double)Math.Abs(lx - ly) / maxDiff;
        count++;
    }
}
