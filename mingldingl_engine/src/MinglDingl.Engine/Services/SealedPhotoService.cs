/// <summary>
/// Orchestrates the "sealed" photo variant: the blur and resize themselves live on
/// <see cref="PhotoCompressionService.SealAsync"/> (the pixel work), this ties that to storage —
/// reading an original that is only named by path, and writing the result beside it. Two callers:
/// the upload action, which already holds the compressed bytes and just wants them sealed and
/// stored, and the maintenance sweep's backfill step, which only has a path for photos uploaded
/// before this feature shipped and has to read the original off disk first.
/// </summary>
public class SealedPhotoService
{
    private readonly PhotoCompressionService _compression;
    private readonly LocalFileStorageService _storage;

    public SealedPhotoService(PhotoCompressionService compression, LocalFileStorageService storage)
    {
        _compression = compression;
        _storage = storage;
    }

    /// <summary>
    /// Seals the original stored at <paramref name="relativePath"/> (the bucket-prefixed relative
    /// path <see cref="LocalFileStorageService.EnumerateProfilePhotos"/> and
    /// <see cref="LocalFileStorageService.RelativePathOf"/> use) and stores the sealed variant
    /// beside it. When <paramref name="compressedOriginal"/> is supplied — the upload action
    /// already has the bytes it just wrote — that is sealed directly; otherwise the original is
    /// read back off disk, which is the only option the backfill sweep has.
    /// </summary>
    public async Task SealAsync(string relativePath, byte[]? compressedOriginal = null)
    {
        var original = compressedOriginal
            ?? await _storage.ReadByRelativePathAsync(relativePath)
            ?? throw new FileNotFoundException($"No stored original at {relativePath}");

        var sealedBytes = await _compression.SealAsync(original);

        var separator = relativePath.IndexOf('/');
        if (separator <= 0) throw new ArgumentException("Relative path must name a bucket", nameof(relativePath));
        var bucket = relativePath[..separator];
        var pathWithinBucket = relativePath[(separator + 1)..];

        await _storage.UploadAsync(bucket, _storage.SealedPathOf(pathWithinBucket), sealedBytes, "image/jpeg");
    }
}
