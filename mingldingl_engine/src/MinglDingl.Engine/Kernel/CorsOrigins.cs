namespace MinglDingl.Engine.Kernel;

public static class CorsOrigins
{
    /// Accepts one comma-separated string (what an environment variable carries) or the indexed-array form.
    public static string[] Parse(string? csv, string[] array) =>
        (string.IsNullOrWhiteSpace(csv) ? array : csv.Split(','))
        .Select(o => o.Trim().TrimEnd('/')).Where(o => o.Length > 0).Distinct().ToArray();
}
