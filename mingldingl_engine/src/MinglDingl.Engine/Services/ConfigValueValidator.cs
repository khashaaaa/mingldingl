using System.Globalization;

public static class ConfigValueValidator
{
    public static string? Validate(string valueType, string value) => valueType switch
    {
        "Bool" => bool.TryParse(value, out _) ? null : $"'{value}' is not a valid boolean",
        "Number" => double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) ? null : $"'{value}' is not a valid number",
        "String" => null,
        _ => $"Unsupported ValueType '{valueType}' for validation",
    };

    /// <summary>
    /// Type check plus the registry's Min/Max bounds. A stored value that parses but sits outside
    /// the bounds is rejected so a slip on the Config page cannot set a price to zero or a tier
    /// threshold negative.
    /// </summary>
    public static string? Validate(ConfigKeyDefinition def, string value)
    {
        var typeError = Validate(def.ValueType, value);
        if (typeError is not null) return typeError;
        if (def.ValueType != "Number") return null;

        double parsed = double.Parse(value, NumberStyles.Float, CultureInfo.InvariantCulture);
        bool belowMin = def.Min is double min && parsed < min;
        bool aboveMax = def.Max is double max && parsed > max;
        if (!belowMin && !aboveMax) return null;

        string lower = def.Min?.ToString(CultureInfo.InvariantCulture) ?? "-∞";
        string upper = def.Max?.ToString(CultureInfo.InvariantCulture) ?? "∞";
        return $"'{value}' is outside the allowed range for {def.Key} (between {lower} and {upper})";
    }
}
