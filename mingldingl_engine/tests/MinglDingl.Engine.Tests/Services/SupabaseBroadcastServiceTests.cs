using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Services;

public class SupabaseBroadcastServiceTests
{
    private sealed class CountingHandler : HttpMessageHandler
    {
        public int Requests { get; private set; }
        public string? LastBody { get; private set; }
        public Uri? LastUri { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            LastUri = request.RequestUri;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(System.Net.HttpStatusCode.OK);
        }
    }

    private static IConfiguration Config(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public async Task Unconfigured_ProjectUrlMissing_ConstructsAndNoOpsBroadcasts()
    {
        var handler = new CountingHandler();
        var service = new SupabaseBroadcastService(new HttpClient(handler), Config([]), NullLogger<SupabaseBroadcastService>.Instance);

        await service.BroadcastAsync("app-nudges", "match_created", new { matchId = Guid.NewGuid() });

        Assert.False(service.IsConfigured);
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task Unconfigured_ProjectUrlEmpty_NoOps()
    {
        var handler = new CountingHandler();
        var config = Config(new Dictionary<string, string?> { ["Supabase:ProjectUrl"] = "", ["Supabase:SecretKey"] = "k" });
        var service = new SupabaseBroadcastService(new HttpClient(handler), config, NullLogger<SupabaseBroadcastService>.Instance);

        await service.BroadcastAsync("topic", "event", new { });

        Assert.False(service.IsConfigured);
        Assert.Equal(0, handler.Requests);
    }

    [Fact]
    public async Task Configured_PostsBroadcastEnvelopeToRealtimeEndpoint()
    {
        var handler = new CountingHandler();
        var config = Config(new Dictionary<string, string?>
        {
            ["Supabase:ProjectUrl"] = "https://test.supabase.co/",
            ["Supabase:SecretKey"] = "test-key",
        });
        var service = new SupabaseBroadcastService(new HttpClient(handler), config, NullLogger<SupabaseBroadcastService>.Instance);

        await service.BroadcastAsync("app-nudges", "match_created", new { matchId = "m1", source = "like" });

        Assert.True(service.IsConfigured);
        Assert.Equal(1, handler.Requests);
        Assert.Equal("https://test.supabase.co/realtime/v1/api/broadcast", handler.LastUri!.ToString());
        Assert.Contains("\"topic\":\"app-nudges\"", handler.LastBody);
        Assert.Contains("\"event\":\"match_created\"", handler.LastBody);
        Assert.Contains("\"payload\":{\"matchId\":\"m1\",\"source\":\"like\"}", handler.LastBody);
    }
}
