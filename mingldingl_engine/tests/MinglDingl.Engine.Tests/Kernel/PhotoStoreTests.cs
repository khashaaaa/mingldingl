using System.Net;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Tests.Kernel;

public class PhotoStoreTests
{
    private sealed class Flaky(params Func<HttpResponseMessage>[] answers) : HttpMessageHandler
    {
        public List<byte[]> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Bodies.Add(await request.Content!.ReadAsByteArrayAsync(ct));
            return answers[Math.Min(Bodies.Count, answers.Length) - 1]();
        }
    }

    private static SupabasePhotoStore Store(Flaky handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("http://storage.test/storage/v1/") },
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Supabase:ProjectUrl"] = "http://storage.test",
            ["Supabase:PhotoBucket"] = "portraits",
        }).Build());

    private static HttpResponseMessage Reset() => throw new HttpRequestException("Connection reset by peer");

    [Fact]
    public async Task Upload_survives_a_dropped_connection_and_resends_the_whole_file()
    {
        var handler = new Flaky(Reset, () => new HttpResponseMessage(HttpStatusCode.OK));
        await Store(handler).PutAsync("a/b.jpg", new MemoryStream([1, 2, 3]));
        handler.Bodies.Should().HaveCount(2);
        handler.Bodies[1].Should().Equal(1, 2, 3);
    }

    [Fact]
    public async Task Upload_retries_a_server_error_but_not_a_refusal()
    {
        var busy = new Flaky(() => new HttpResponseMessage(HttpStatusCode.BadGateway), () => new HttpResponseMessage(HttpStatusCode.OK));
        await Store(busy).PutAsync("a/b.jpg", new MemoryStream([1]));
        busy.Bodies.Should().HaveCount(2);

        var refused = new Flaky(() => new HttpResponseMessage(HttpStatusCode.Forbidden));
        var act = () => Store(refused).PutAsync("a/b.jpg", new MemoryStream([1]));
        await act.Should().ThrowAsync<HttpRequestException>();
        refused.Bodies.Should().HaveCount(1);
    }

    [Fact]
    public async Task Upload_gives_up_after_three_tries()
    {
        var handler = new Flaky(Reset);
        var act = () => Store(handler).PutAsync("a/b.jpg", new MemoryStream([1]));
        await act.Should().ThrowAsync<HttpRequestException>();
        handler.Bodies.Should().HaveCount(3);
    }
}
