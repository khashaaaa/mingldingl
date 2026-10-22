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

    /// Many paths at once: path → signed URL. A store without a bulk call signs them one by one.
    async Task<IReadOnlyDictionary<string, string>> SignManyAsync(IReadOnlyList<string> paths, TimeSpan ttl, CancellationToken ct = default)
    {
        var result = new Dictionary<string, string>();
        foreach (var path in paths.Distinct()) result[path] = await SignAsync(path, ttl, ct);
        return result;
    }
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

    /// Supabase's bulk sign (`POST object/sign/{bucket}` with `paths`): one round trip for a page of
    /// portraits. A path it could not sign is signed alone (and fails loudly there).
    public async Task<IReadOnlyDictionary<string, string>> SignManyAsync(IReadOnlyList<string> paths, TimeSpan ttl, CancellationToken ct = default)
    {
        var result = new Dictionary<string, string>();
        var distinct = paths.Distinct().ToList();
        if (distinct.Count == 0) return result;
        if (distinct.Count == 1)
        {
            result[distinct[0]] = await SignAsync(distinct[0], ttl, ct);
            return result;
        }
        using var res = await http.PostAsJsonAsync($"object/sign/{Bucket}", new { expiresIn = (int)ttl.TotalSeconds, paths = distinct }, ct);
        res.EnsureSuccessStatusCode();
        var rows = await res.Content.ReadFromJsonAsync<List<BulkSignRow>>(ct) ?? [];
        foreach (var r in rows)
            if (r is { Path: { } path, SignedUrl: { Length: > 0 } url, Error: null }) result[path] = $"{Origin}/storage/v1{url}";
        foreach (var missing in distinct.Where(p => !result.ContainsKey(p)))
            result[missing] = await SignAsync(missing, ttl, ct);
        return result;
    }

    private sealed record SignResponse([property: JsonPropertyName("signedURL")] string SignedUrl);

    private sealed record BulkSignRow(
        [property: JsonPropertyName("path")] string? Path,
        [property: JsonPropertyName("signedURL")] string? SignedUrl,
        [property: JsonPropertyName("error")] string? Error);
}
