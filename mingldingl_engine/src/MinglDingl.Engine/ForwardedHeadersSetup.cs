using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

/// <summary>
/// Which reverse proxies may rewrite the caller's address and scheme. Behind a proxy every request
/// arrives from the proxy's own IP, so the per-IP limiters (<see cref="PhoneStartRateLimit"/>, the
/// admin login throttle) put the whole internet in one partition. Trust is opt-in: only
/// <c>ForwardedHeaders:KnownProxies</c> (single IPs) and <c>ForwardedHeaders:KnownNetworks</c>
/// (CIDR ranges) are believed, on top of ASP.NET's loopback default, so a client connecting
/// directly cannot pick its own rate-limit partition by sending <c>X-Forwarded-For</c>. Both accept
/// the indexed-array form or one comma-separated string, like <see cref="CorsOrigins"/>.
/// </summary>
public static class ForwardedHeadersSetup
{
    public static void Configure(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

        foreach (var entry in ReadList(configuration, "ForwardedHeaders:KnownProxies"))
        {
            if (!IPAddress.TryParse(entry, out var address))
                throw new InvalidOperationException($"ForwardedHeaders:KnownProxies entry '{entry}' is not an IP address.");
            options.KnownProxies.Add(address);
        }

        foreach (var entry in ReadList(configuration, "ForwardedHeaders:KnownNetworks"))
            options.KnownNetworks.Add(ParseNetwork(entry));
    }

    private static Microsoft.AspNetCore.HttpOverrides.IPNetwork ParseNetwork(string cidr)
    {
        var parts = cidr.Split('/');
        if (parts.Length == 2
            && IPAddress.TryParse(parts[0], out var prefix)
            && int.TryParse(parts[1], out var length)
            && length >= 0
            && length <= (prefix.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6 ? 128 : 32))
            return new Microsoft.AspNetCore.HttpOverrides.IPNetwork(prefix, length);

        throw new InvalidOperationException($"ForwardedHeaders:KnownNetworks entry '{cidr}' is not a CIDR range.");
    }

    private static IEnumerable<string> ReadList(IConfiguration configuration, string key)
    {
        var section = configuration.GetSection(key);
        var values = section.GetChildren().Select(c => c.Value).ToList();
        if (values.Count == 0) values.Add(section.Value);

        return values
            .SelectMany(v => (v ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }
}
