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
        var signed = await urls.GetManyAsync(photos.Select(p => (p.Id, p.Path)), ct);
        return photos.Select(p => View(p, signed[p.Id])).ToList();
    }

    /// checkFace: false only for the dev seeders, whose stand-in portraits are drawings shared between
    /// seeded people (so they skip the same-photo check too).
    public async Task<PhotoView> UploadAsync(Guid accountId, byte[] bytes, string? clientKey, CancellationToken ct = default,
        bool checkFace = true)
    {
        if (string.IsNullOrWhiteSpace(clientKey) || clientKey.Length > 64)
            throw new DomainException(400, "photos.key", "Idempotency-Key header is required");
        if (await Existing(accountId, clientKey, ct) is { } already) return await ViewAsync(already, ct);
        if (bytes.Length == 0 || bytes.Length > MaxUploadBytes)
            throw new DomainException(400, "photos.too_large", "That photo is too large");

        var image = ImagePipeline.Process(bytes, findFace: checkFace && config.Bool(ConfigKeys.PhotosRequireFace));
        if (image.Face == false)
            throw new DomainException(400, "photos.no_face", "We could not find a face in this portrait");
        if (checkFace && config.Bool(ConfigKeys.PhotosRefuseSame))
            await RefuseSameAsync(accountId, image.SameHash, ct);
        var photo = new Photo
        {
            Id = Guid.CreateVersion7(),
            AccountId = accountId,
            Width = image.Width,
            Height = image.Height,
            ThumbHash = image.ThumbHash,
            SameHash = image.SameHash,
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
            await ForgetFaceAsync(accountId, ct);
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

    /// A photo already stored is refused: one's own twice fills a slot with nothing new, and someone
    /// else's is a borrowed face (a stolen or shared picture, or a barred person coming back).
    private async Task RefuseSameAsync(Guid accountId, long hash, CancellationToken ct)
    {
        var bits = config.Int(ConfigKeys.PhotosSameBits);
        var owners = await db.Database.SqlQuery<Guid>($"""
            SELECT "AccountId" AS "Value" FROM photos
            WHERE "SameHash" IS NOT NULL AND bit_count(int8send("SameHash" # {hash})) <= {bits}
            """).ToListAsync(ct);
        if (owners.Contains(accountId))
            throw new DomainException(409, "photos.same", "You already have this portrait");
        if (owners.Count > 0)
        {
            log.LogWarning("Upload by {Account} matches a portrait of {Owners}", accountId, string.Join(", ", owners.Distinct()));
            throw new DomainException(409, "photos.taken", "This photo is already on another character");
        }
    }

    /// Portraits stored before the same-photo check gain their hash from their file; one that cannot
    /// be read stays without and is skipped (it then matches nothing). A no-op once all have one.
    public static async Task BackfillSameHashAsync(IServiceProvider sp, CancellationToken ct = default)
    {
        await using var scope = sp.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();
        var store = scope.ServiceProvider.GetRequiredService<IPhotoStore>();
        var log = scope.ServiceProvider.GetRequiredService<ILogger<PhotoService>>();
        var missing = await db.Set<Photo>().Where(p => p.SameHash == null).ToListAsync(ct);
        // Eight files at a time, saved a batch at a time: an interrupted boot keeps what it hashed.
        foreach (var batch in missing.Chunk(32))
        {
            await Parallel.ForEachAsync(batch, new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct }, async (p, token) =>
            {
                try
                {
                    using var bitmap = ImagePipeline.DecodeUpright(await store.GetAsync(p.Path, token));
                    p.SameHash = ImagePipeline.SameHash(bitmap);
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    log.LogWarning(e, "Could not hash portrait {Photo}", p.Id);
                }
            });
            await db.SaveChangesAsync(ct);
        }
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
        await ForgetFaceAsync(accountId, ct);
        Announce(accountId);
        await db.SaveChangesAsync(ct);
        urls.Forget(photoId);
        await DeleteFileQuietly(target.Path);
    }

    /// Someone else's portraits: the first `revealed` carry a signed URL; the rest only their
    /// ThumbHash — the image itself never leaves the engine until a seal breaks.
    public Task<IReadOnlyList<PortraitView>> PortraitsAsync(Guid accountId, int revealed, CancellationToken ct = default) =>
        PortraitsAsync(accountId, _ => revealed, ct);

    /// revealedOf: how many to reveal, given how many portraits there are (read once, with the rows).
    public async Task<IReadOnlyList<PortraitView>> PortraitsAsync(Guid accountId, Func<int, int> revealedOf, CancellationToken ct = default)
    {
        var photos = await db.Set<Photo>().AsNoTracking().Where(p => p.AccountId == accountId)
            .OrderBy(p => p.Position).ToListAsync(ct);
        var revealed = revealedOf(photos.Count);
        var signed = await urls.GetManyAsync(photos.Where(p => p.Position < revealed).Select(p => (p.Id, p.Path)), ct);
        return photos.Select(p =>
        {
            var hash = Convert.ToBase64String(p.ThumbHash);
            return signed.TryGetValue(p.Id, out var s)
                ? new PortraitView(p.Id, p.Position, hash, p.Width, p.Height, s.Url, s.ExpiresAt)
                : new PortraitView(p.Id, p.Position, hash, p.Width, p.Height, null, null);
        }).ToList();
    }

    /// The first portrait of each account, for list rows; signed only where `revealed` says so.
    public async Task<IReadOnlyDictionary<Guid, PortraitView>> FirstPortraitsAsync(
        IReadOnlyDictionary<Guid, bool> revealed, CancellationToken ct = default)
    {
        var ids = revealed.Keys.ToList();
        var firsts = await db.Set<Photo>().AsNoTracking().Where(p => ids.Contains(p.AccountId) && p.Position == 0).ToListAsync(ct);
        var signed = await urls.GetManyAsync(firsts.Where(p => revealed[p.AccountId]).Select(p => (p.Id, p.Path)), ct);
        var result = new Dictionary<Guid, PortraitView>();
        foreach (var p in firsts)
        {
            var hash = Convert.ToBase64String(p.ThumbHash);
            result[p.AccountId] = signed.TryGetValue(p.Id, out var s)
                ? new PortraitView(p.Id, 0, hash, p.Width, p.Height, s.Url, s.ExpiresAt)
                : new PortraitView(p.Id, 0, hash, p.Width, p.Height, null, null);
        }
        return result;
    }

    /// The stored portraits' bytes, in order — only for the face check, which keeps nothing of them.
    public async Task<IReadOnlyList<byte[]>> PortraitFilesAsync(Guid accountId, CancellationToken ct = default)
    {
        var paths = await db.Set<Photo>().AsNoTracking().Where(p => p.AccountId == accountId)
            .OrderBy(p => p.Position).Select(p => p.Path).ToListAsync(ct);
        return await Task.WhenAll(paths.Select(path => store.GetAsync(path, ct)));
    }

    /// A proven face was proven against the portraits as they were: any change takes the mark off.
    private async Task ForgetFaceAsync(Guid accountId, CancellationToken ct)
    {
        if (await db.Set<Profile.Profile>().Where(p => p.AccountId == accountId && p.FaceProvenAt != null)
                .ExecuteUpdateAsync(u => u.SetProperty(p => p.FaceProvenAt, (DateTimeOffset?)null), ct) > 0)
            live.ToAccount(accountId, LiveKinds.ProfileUpdated, accountId);
    }

    private void Announce(Guid accountId)
    {
        live.ToAccount(accountId, LiveKinds.PhotosUpdated, accountId);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
    }

    private Task<Photo?> Existing(Guid accountId, string key, CancellationToken ct) =>
        db.Set<Photo>().AsNoTracking().SingleOrDefaultAsync(p => p.AccountId == accountId && p.ClientKey == key, ct);

    private async Task<PhotoView> ViewAsync(Photo p, CancellationToken ct) => View(p, await urls.GetAsync(p, ct));

    private static PhotoView View(Photo p, (string Url, DateTimeOffset ExpiresAt) s) =>
        new(p.Id, s.Url, s.ExpiresAt, Convert.ToBase64String(p.ThumbHash), p.Width, p.Height, p.Position);

    private async Task DeleteFileQuietly(string path)
    {
        try { await store.DeleteAsync(path); }
        catch (Exception e) { log.LogWarning(e, "Could not delete stored photo {Path}", path); }
    }

    private static long LockKey(Guid accountId) =>
        BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("photos:" + accountId)), 0);
}
