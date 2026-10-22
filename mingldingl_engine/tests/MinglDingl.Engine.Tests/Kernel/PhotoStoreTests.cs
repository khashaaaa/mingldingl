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

    [Fact]
    public async Task Many_paths_are_signed_in_one_call_and_a_refused_one_alone()
    {
        var handler = new Flaky(
            () => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    [{"path":"a/1.jpg","signedURL":"/object/sign/portraits/a/1.jpg?token=x","error":null},
                     {"path":"a/2.jpg","signedURL":null,"error":"Either the object does not exist or you do not have access to it"}]
                    """, System.Text.Encoding.UTF8, "application/json"),
            },
            () => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"signedURL":"/object/sign/portraits/a/2.jpg?token=y"}""", System.Text.Encoding.UTF8, "application/json"),
            });
        var signed = await Store(handler).SignManyAsync(["a/1.jpg", "a/2.jpg", "a/1.jpg"], TimeSpan.FromHours(1));
        handler.Bodies.Should().HaveCount(2, "one bulk call, then the refused path alone");
        System.Text.Encoding.UTF8.GetString(handler.Bodies[0]).Should().Contain("\"paths\":[\"a/1.jpg\",\"a/2.jpg\"]");
        signed.Should().HaveCount(2);
        signed["a/1.jpg"].Should().Be("http://storage.test/storage/v1/object/sign/portraits/a/1.jpg?token=x");
        signed["a/2.jpg"].Should().Be("http://storage.test/storage/v1/object/sign/portraits/a/2.jpg?token=y");
    }
}
