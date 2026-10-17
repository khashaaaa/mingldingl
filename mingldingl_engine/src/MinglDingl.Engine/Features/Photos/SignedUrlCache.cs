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

    public void Forget(Guid photoId) => cache.Remove("signed:" + photoId);
}
