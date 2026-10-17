using System.Text.RegularExpressions;
using Sentry;

namespace MinglDingl.Engine.Kernel.Errors;

/// Nothing personal leaves the engine: no bodies, query strings, cookies, auth headers,
/// phone numbers or tokens.
public static partial class SentryScrub
{
    public static SentryEvent Scrub(SentryEvent e)
    {
        e.Request.Data = null;
        e.Request.QueryString = null;
        e.Request.Cookies = null;
        e.Request.Headers.Remove("Authorization");
        e.Request.Headers.Remove("Cookie");
        e.User = new SentryUser();
        if (e.Message is { } m)
        {
            m.Formatted = Text(m.Formatted);
            m.Message = Text(m.Message);
        }
        foreach (var ex in e.SentryExceptions ?? []) ex.Value = Text(ex.Value);
        return e;
    }

    public static string? Text(string? s) =>
        s is null ? null : Phone().Replace(Jwt().Replace(s, "[token]"), "[phone]");

    [GeneratedRegex(@"(?<!\d)\d{8}(?!\d)")]
    private static partial Regex Phone();

    [GeneratedRegex(@"eyJ[\w-]+\.[\w-]+\.[\w-]+")]
    private static partial Regex Jwt();
}
