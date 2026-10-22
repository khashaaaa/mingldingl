using Microsoft.Extensions.Caching.Memory;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Features.Photos;

/// One signed URL per photo, reused until it has under 10 minutes left, so a device reading the
/// same photo twice gets the same URL (and its image cache is not filled with duplicates).
public sealed class SignedUrlCache(IPhotoStore store, IMemoryCache cache, IClock clock)
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(60);
    public static readonly TimeSpan RenewBefore = TimeSpan.FromMinutes(10);

    public Task<(string Url, DateTimeOffset ExpiresAt)> GetAsync(Photo p, CancellationToken ct = default) =>
        GetAsync(p.Id, p.Path, ct);

    /// Any stored image by its id and path (portraits, venue photos).
    public async Task<(string Url, DateTimeOffset ExpiresAt)> GetAsync(Guid id, string path, CancellationToken ct = default)
    {
        var key = "signed:" + id;
        if (cache.TryGetValue(key, out (string Url, DateTimeOffset ExpiresAt) hit) && hit.ExpiresAt - clock.UtcNow > RenewBefore)
            return hit;
        var url = await store.SignAsync(path, Ttl, ct);
        var fresh = (url, clock.UtcNow.Add(Ttl));
        cache.Set(key, fresh, Ttl);
        return fresh;
    }

    /// Many images at once: cached ones as they are, the rest signed in one call to the store.
    public async Task<IReadOnlyDictionary<Guid, (string Url, DateTimeOffset ExpiresAt)>> GetManyAsync(
        IEnumerable<(Guid Id, string Path)> images, CancellationToken ct = default)
    {
        var result = new Dictionary<Guid, (string Url, DateTimeOffset ExpiresAt)>();
        var missing = new List<(Guid Id, string Path)>();
        foreach (var (id, path) in images)
        {
            if (result.ContainsKey(id)) continue;
            if (cache.TryGetValue("signed:" + id, out (string Url, DateTimeOffset ExpiresAt) hit) && hit.ExpiresAt - clock.UtcNow > RenewBefore)
                result[id] = hit;
            else if (missing.All(m => m.Id != id)) missing.Add((id, path));
        }
        if (missing.Count == 0) return result;
        var signed = await store.SignManyAsync(missing.Select(m => m.Path).ToList(), Ttl, ct);
        var expires = clock.UtcNow.Add(Ttl);
        foreach (var (id, path) in missing)
        {
            var fresh = (signed[path], expires);
            cache.Set("signed:" + id, fresh, Ttl);
            result[id] = fresh;
        }
        return result;
    }

    public void Forget(Guid photoId) => cache.Remove("signed:" + photoId);
}
