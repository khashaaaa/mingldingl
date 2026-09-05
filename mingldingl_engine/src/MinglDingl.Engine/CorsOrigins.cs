using Microsoft.Extensions.Configuration;

/// <summary>
/// `Cors:AllowedOrigins` accepts either the indexed-array form configuration binds natively
/// (`Cors__AllowedOrigins__0=…`) or one comma-separated string, so a single env var can carry
/// both the app's web origin and the admin panel's.
/// </summary>
public static class CorsOrigins
{
    public static string[] Parse(IConfiguration configuration)
    {
        var section = configuration.GetSection("Cors:AllowedOrigins");
        IEnumerable<string?> raw = section.Value is { } scalar
            ? scalar.Split(',')
            : section.GetChildren().Select(c => c.Value);
        return raw
            .Select(o => o?.Trim())
            .Where(o => !string.IsNullOrEmpty(o))
            .Select(o => o!)
            .ToArray();
    }
}
