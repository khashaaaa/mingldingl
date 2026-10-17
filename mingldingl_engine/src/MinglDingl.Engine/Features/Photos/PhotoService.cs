using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Features.Photos;

public sealed class PhotoService(
    AppDb db, IPhotoStore store, SignedUrlCache urls, IClock clock, IConfig config, ILiveOutbox live, ILogger<PhotoService> log)
{
    public const long MaxUploadBytes = 15 * 1024 * 1024;

    public async Task<IReadOnlyList<PhotoView>> ListAsync(Guid accountId, CancellationToken ct = default)
    {
        var photos = await db.Set<Photo>().AsNoTracking().Where(p => p.AccountId == accountId)
            .OrderBy(p => p.Position).ToListAsync(ct);
        var views = new List<PhotoView>(photos.Count);
        foreach (var p in photos) views.Add(await ViewAsync(p, ct));
        return views;
    }

    public async Task<PhotoView> UploadAsync(Guid accountId, byte[] bytes, string? clientKey, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(clientKey) || clientKey.Length > 64)
            throw new DomainException(400, "photos.key", "Idempotency-Key header is required");
        if (await Existing(accountId, clientKey, ct) is { } already) return await ViewAsync(already, ct);
        if (bytes.Length == 0 || bytes.Length > MaxUploadBytes)
            throw new DomainException(400, "photos.too_large", "That photo is too large");

        var image = ImagePipeline.Process(bytes);
        var photo = new Photo
        {
            Id = Guid.CreateVersion7(),
            AccountId = accountId,
            Width = image.Width,
            Height = image.Height,
            ThumbHash = image.ThumbHash,
            ClientKey = clientKey,
            CreatedAt = clock.UtcNow,
        };
        photo.Path = $"{accountId}/{photo.Id}.jpg";

        // The file goes first: a row never points at a file that is not there.
        await store.PutAsync(photo.Path, new MemoryStream(image.Jpeg), ct);
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({LockKey(accountId)})", ct);
            if (await Existing(accountId, clientKey, ct) is { } raced)
            {
                await tx.RollbackAsync(ct);
                await DeleteFileQuietly(photo.Path);
                return await ViewAsync(raced, ct);
            }
            var count = await db.Set<Photo>().CountAsync(p => p.AccountId == accountId, ct);
            if (count >= config.Int(ConfigKeys.PhotosMax))
                throw new DomainException(409, "photos.full", "You already have the most portraits allowed");
            photo.Position = count;
            db.Add(photo);
            Announce(accountId);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await DeleteFileQuietly(photo.Path);
            throw;
        }
        return await ViewAsync(photo, ct);
    }

    public async Task<IReadOnlyList<PhotoView>> ReorderAsync(Guid accountId, IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        var photos = await db.Set<Photo>().Where(p => p.AccountId == accountId).ToListAsync(ct);
        if (ids.Count != photos.Count || ids.Distinct().Count() != ids.Count || !photos.All(p => ids.Contains(p.Id)))
            throw new DomainException(400, "photos.order_mismatch", "The order must list each of your portraits once");
        foreach (var p in photos) p.Position = ids.ToList().IndexOf(p.Id);
        Announce(accountId);
        await db.SaveChangesAsync(ct);
        return await ListAsync(accountId, ct);
    }

    /// <param name="keepMinimum">False only for the dev seeder, which resets an account wholesale.</param>
    public async Task DeleteAsync(Guid accountId, Guid photoId, CancellationToken ct = default, bool keepMinimum = true)
    {
        var photos = await db.Set<Photo>().Where(p => p.AccountId == accountId).OrderBy(p => p.Position).ToListAsync(ct);
        var target = photos.SingleOrDefault(p => p.Id == photoId)
            ?? throw new DomainException(404, "photos.not_found", "That portrait does not exist");
        // A finished character keeps the minimum: falling under it would reopen onboarding mid-edit.
        var min = config.Int(ConfigKeys.PhotosMin);
        if (keepMinimum && photos.Count <= min
            && await db.Set<Profile.Profile>().AnyAsync(p => p.AccountId == accountId && p.WelcomedAt != null, ct))
            throw new DomainException(409, "photos.min", $"Keep at least {min} portraits — add another first");
        db.Remove(target);
        var i = 0;
        foreach (var p in photos.Where(p => p.Id != photoId)) p.Position = i++;
        Announce(accountId);
        await db.SaveChangesAsync(ct);
        urls.Forget(photoId);
        await DeleteFileQuietly(target.Path);
    }

    /// Someone else's portraits: the first `revealed` carry a signed URL; the rest only their
    /// ThumbHash — the image itself never leaves the engine until a seal breaks.
    public async Task<IReadOnlyList<PortraitView>> PortraitsAsync(Guid accountId, int revealed, CancellationToken ct = default)
    {
        var photos = await db.Set<Photo>().AsNoTracking().Where(p => p.AccountId == accountId)
            .OrderBy(p => p.Position).ToListAsync(ct);
        var views = new List<PortraitView>(photos.Count);
        foreach (var p in photos)
        {
            var hash = Convert.ToBase64String(p.ThumbHash);
            if (p.Position < revealed)
            {
                var (url, expires) = await urls.GetAsync(p, ct);
                views.Add(new PortraitView(p.Id, p.Position, hash, p.Width, p.Height, url, expires));
            }
            else views.Add(new PortraitView(p.Id, p.Position, hash, p.Width, p.Height, null, null));
        }
        return views;
    }

    /// The first portrait of each account, for list rows; signed only where `revealed` says so.
    public async Task<IReadOnlyDictionary<Guid, PortraitView>> FirstPortraitsAsync(
        IReadOnlyDictionary<Guid, bool> revealed, CancellationToken ct = default)
    {
        var ids = revealed.Keys.ToList();
        var firsts = await db.Set<Photo>().AsNoTracking().Where(p => ids.Contains(p.AccountId) && p.Position == 0).ToListAsync(ct);
        var result = new Dictionary<Guid, PortraitView>();
        foreach (var p in firsts)
        {
            var hash = Convert.ToBase64String(p.ThumbHash);
            if (revealed[p.AccountId])
            {
                var (url, expires) = await urls.GetAsync(p, ct);
                result[p.AccountId] = new PortraitView(p.Id, 0, hash, p.Width, p.Height, url, expires);
            }
            else result[p.AccountId] = new PortraitView(p.Id, 0, hash, p.Width, p.Height, null, null);
        }
        return result;
    }

    private void Announce(Guid accountId)
    {
        live.ToAccount(accountId, LiveKinds.PhotosUpdated, accountId);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
    }

    private Task<Photo?> Existing(Guid accountId, string key, CancellationToken ct) =>
        db.Set<Photo>().AsNoTracking().SingleOrDefaultAsync(p => p.AccountId == accountId && p.ClientKey == key, ct);

    private async Task<PhotoView> ViewAsync(Photo p, CancellationToken ct)
    {
        var (url, expires) = await urls.GetAsync(p, ct);
        return new PhotoView(p.Id, url, expires, Convert.ToBase64String(p.ThumbHash), p.Width, p.Height, p.Position);
    }

    private async Task DeleteFileQuietly(string path)
    {
        try { await store.DeleteAsync(path); }
        catch (Exception e) { log.LogWarning(e, "Could not delete stored photo {Path}", path); }
    }

    private static long LockKey(Guid accountId) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("photos:" + accountId)), 0);
}

public sealed class PhotoCount(AppDb db) : IPhotoCount
{
    public Task<int> CountAsync(Guid accountId, CancellationToken ct = default) =>
        db.Set<Photo>().CountAsync(p => p.AccountId == accountId, ct);
}
