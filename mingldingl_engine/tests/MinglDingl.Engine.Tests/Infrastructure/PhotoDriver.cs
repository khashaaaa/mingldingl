using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Tests.Infrastructure;

public static class PhotoDriver
{
    public static string Fixture(string name) => Path.Combine(AppContext.BaseDirectory, "Fixtures", name);

    public static MemoryPhotoStore UseMemoryPhotoStore(this EngineFactory f)
    {
        var store = new MemoryPhotoStore();
        f.WithServices(s => { s.RemoveAll<IPhotoStore>(); s.AddSingleton<IPhotoStore>(store); });
        return store;
    }

    public static async Task<HttpResponseMessage> UploadRawAsync(this HttpClient c, byte[] bytes, string? key = null, string fileName = "p.jpg")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(file, "file", fileName);
        var req = new HttpRequestMessage(HttpMethod.Post, "/me/photos") { Content = form };
        req.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString());
        return await c.SendAsync(req);
    }

    public static async Task<PhotoView> UploadAsync(this HttpClient c, string fixture = "photo-3.jpg", string? key = null)
    {
        var r = await c.UploadRawAsync(await File.ReadAllBytesAsync(Fixture(fixture)), key);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<PhotoView>())!;
    }

    public static async Task<List<PhotoView>> PhotosAsync(this HttpClient c) =>
        (await c.GetFromJsonAsync<List<PhotoView>>("/me/photos"))!;
}
