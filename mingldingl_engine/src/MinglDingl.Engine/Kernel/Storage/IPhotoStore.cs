using System.Net.Http.Headers;
using System.Text.Json.Serialization;

namespace MinglDingl.Engine.Kernel.Storage;

/// Private photo storage. Nothing in it is reachable without a signed URL.
public interface IPhotoStore
{
    Task PutAsync(string path, Stream jpeg, CancellationToken ct = default);
    Task DeleteAsync(string path, CancellationToken ct = default);
    Task<byte[]> GetAsync(string path, CancellationToken ct = default);
    Task<string> SignAsync(string path, TimeSpan ttl, CancellationToken ct = default);
}

/// Supabase Storage, private bucket, authenticated with the project's secret key (engine only).
public sealed class SupabasePhotoStore(HttpClient http, IConfiguration config) : IPhotoStore
{
    private string Bucket => config["Supabase:PhotoBucket"] ?? "portraits";
    private string Origin => config["Supabase:ProjectUrl"]!.TrimEnd('/');

    private const int PutAttempts = 3;

    /// A dropped connection or a 5xx is retried (the path is new per photo and the write upserts, so a
    /// repeat is harmless); one reset otherwise cost the person a "Lost — tap". A 4xx is not retried.
    public async Task PutAsync(string path, Stream jpeg, CancellationToken ct = default)
    {
        using var buffer = new MemoryStream();
        await jpeg.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var content = new ByteArrayContent(bytes);
                content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                using var req = new HttpRequestMessage(HttpMethod.Post, $"object/{Bucket}/{path}") { Content = content };
                req.Headers.Add("x-upsert", "true");
                using var res = await http.SendAsync(req, ct);
                if ((int)res.StatusCode < 500 || attempt == PutAttempts)
                {
                    res.EnsureSuccessStatusCode();
                    return;
                }
            }
            catch (HttpRequestException e) when (e.StatusCode is null && attempt < PutAttempts)
            {
            }
            await Task.Delay(TimeSpan.FromMilliseconds(200 * attempt), ct);
        }
    }

    public async Task DeleteAsync(string path, CancellationToken ct = default)
    {
        using var res = await http.DeleteAsync($"object/{Bucket}/{path}", ct);
        if (res.StatusCode != System.Net.HttpStatusCode.NotFound) res.EnsureSuccessStatusCode();
    }

    public async Task<byte[]> GetAsync(string path, CancellationToken ct = default)
    {
        using var res = await http.GetAsync($"object/authenticated/{Bucket}/{path}", ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task<string> SignAsync(string path, TimeSpan ttl, CancellationToken ct = default)
    {
        using var res = await http.PostAsJsonAsync($"object/sign/{Bucket}/{path}", new { expiresIn = (int)ttl.TotalSeconds }, ct);
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<SignResponse>(ct);
        return $"{Origin}/storage/v1{body!.SignedUrl}";
    }

    private sealed record SignResponse([property: JsonPropertyName("signedURL")] string SignedUrl);
}
