using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace MinglDingl.Engine.Tests;

/// <summary>
/// Behind a reverse proxy every request arrives from the proxy's IP, so the per-IP limiters put the
/// whole internet in one bucket — but trusting X-Forwarded-For from anyone would let a direct caller
/// choose its own bucket. Only configured proxies may rewrite the address.
/// </summary>
public class ForwardedHeadersSetupTests
{
    private static ForwardedHeadersOptions Options(Dictionary<string, string?> values)
    {
        var options = new ForwardedHeadersOptions();
        ForwardedHeadersSetup.Configure(options, new ConfigurationBuilder().AddInMemoryCollection(values).Build());
        return options;
    }

    private static async Task<IPAddress?> ClientIpSeenAsync(ForwardedHeadersOptions options, string remoteIp, string forwardedFor)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(remoteIp);
        context.Request.Headers["X-Forwarded-For"] = forwardedFor;

        IPAddress? seen = null;
        var middleware = new ForwardedHeadersMiddleware(
            ctx => { seen = ctx.Connection.RemoteIpAddress; return Task.CompletedTask; },
            NullLoggerFactory.Instance,
            Microsoft.Extensions.Options.Options.Create(options));
        await middleware.Invoke(context);
        return seen;
    }

    [Fact]
    public async Task AConfiguredProxyNetwork_HasItsForwardedClientAddressBelieved()
    {
        var options = Options(new() { ["ForwardedHeaders:KnownNetworks"] = "10.0.0.0/8, 172.16.0.0/12" });

        Assert.Equal(IPAddress.Parse("203.0.113.7"), await ClientIpSeenAsync(options, "172.18.0.2", "203.0.113.7"));
    }

    [Fact]
    public async Task ADirectCallerSendingXForwardedFor_CannotPickItsOwnAddress()
    {
        var options = Options(new() { ["ForwardedHeaders:KnownProxies:0"] = "10.1.2.3" });

        Assert.Equal(IPAddress.Parse("198.51.100.9"), await ClientIpSeenAsync(options, "198.51.100.9", "203.0.113.7"));
    }

    [Fact]
    public async Task NothingConfigured_TrustsOnlyLoopback()
    {
        var options = Options(new());

        Assert.Equal(IPAddress.Parse("198.51.100.9"), await ClientIpSeenAsync(options, "198.51.100.9", "203.0.113.7"));
        Assert.Equal(IPAddress.Parse("203.0.113.7"), await ClientIpSeenAsync(options, "127.0.0.1", "203.0.113.7"));
    }

    [Theory]
    [InlineData("ForwardedHeaders:KnownProxies", "not-an-ip")]
    [InlineData("ForwardedHeaders:KnownNetworks", "10.0.0.0")]
    [InlineData("ForwardedHeaders:KnownNetworks", "10.0.0.0/33")]
    public void AMalformedEntry_FailsAtStartupRatherThanTrustingNothingSilently(string key, string value) =>
        Assert.Throws<InvalidOperationException>(() => Options(new() { [key] = value }));
}
