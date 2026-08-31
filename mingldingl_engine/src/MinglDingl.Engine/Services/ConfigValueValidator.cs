public static class ConfigValueValidator
{
    public static string? Validate(string valueType, string value) => valueType switch
    {
        "Bool" => bool.TryParse(value, out _) ? null : $"'{value}' is not a valid boolean",
        "Number" => double.TryParse(value, out _) ? null : $"'{value}' is not a valid number",
        "String" => null,
        _ => $"Unsupported ValueType '{valueType}' for validation",
    };
}
