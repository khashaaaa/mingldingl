using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public partial class LocalFileStorageService
{
    private readonly string _root;
    private readonly string _publicBaseUrl;
    private readonly ILogger<LocalFileStorageService> _logger;
    private readonly byte[] _sealKey;

    public LocalFileStorageService(IWebHostEnvironment env, IConfiguration config, ILogger<LocalFileStorageService> logger)
    {
        _root = Path.GetFullPath(Path.Combine(env.ContentRootPath, "uploads"));
        _publicBaseUrl = (config["Storage:PublicBaseUrl"] ?? "http://localhost:5150/uploads").TrimEnd('/');
        _logger = logger;
        _sealKey = DeriveSealKey(config);
        Directory.CreateDirectory(_root);
    }

    /// <summary>
    /// The key sealed filenames are derived under. <c>Storage:SealedPhotoKey</c> when set, otherwise
    /// a sub-key of <c>Admin:JwtSigningKey</c> (which <see cref="StartupGuards"/> already requires
    /// outside Development). Rotating either renames every sealed variant: the backfill sweep
    /// regenerates them under the new names and the orphan sweep removes the old ones. The constant
    /// fallback only ever applies where neither is configured, i.e. local development and tests.
    /// </summary>
    private static byte[] DeriveSealKey(IConfiguration config)
    {
        var secret = config["Storage:SealedPhotoKey"];
        if (string.IsNullOrWhiteSpace(secret)) secret = config["Admin:JwtSigningKey"];
        if (string.IsNullOrWhiteSpace(secret)) secret = "mingldingl-development-only-sealed-photo-key";
        return HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), "sealed-photo-name/v1"u8);
    }

    /// <summary>
    /// Resolves a bucket-relative path inside the uploads root, refusing anything that escapes it.
    /// Callers currently pass server-built paths, but the guard keeps that from being load-bearing.
    /// </summary>
    private string? ResolveWithinRoot(string bucket, string path)
    {
        var combined = Path.GetFullPath(Path.Combine(_root, bucket, path));
        var prefix = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        return combined.StartsWith(prefix, StringComparison.Ordinal) ? combined : null;
    }

    /// <summary>The bucket every user-uploaded profile photo lives in.</summary>
    public const string PhotoBucket = "photos";

    /// <summary>
    /// The one directory a given user's profile photos may live in. Both the writer
    /// (<c>POST /photos/upload</c>) and the ownership check read this, so a URL can never be
    /// accepted for a directory nobody would have written it to.
    /// </summary>
    public static string ProfilePhotoDirectory(Guid ownerId) => $"profiles/{ownerId}/";

    public async Task<string> UploadAsync(string bucket, string path, byte[] bytes, string contentType)
    {
        var fullPath = ResolveWithinRoot(bucket, path)
            ?? throw new ArgumentException("Resolved path escapes the uploads root", nameof(path));

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllBytesAsync(fullPath, bytes);
        return $"{_publicBaseUrl}/{bucket}/{path}";
    }

    /// <summary>
    /// Deletes a stored file given the public URL previously returned by <see cref="UploadAsync"/>.
    /// Returns false for URLs this service did not issue. Never throws: deletion runs from the
    /// maintenance sweep, where one bad row must not abort the rest of the pass.
    /// </summary>
    /// <summary>
    /// True when <paramref name="url"/> addresses a file this engine issued — the only place a
    /// profile photo may live. Anything else is someone else's origin: it leaks every viewer's IP
    /// to whoever runs it, and its contents can be swapped after moderation has passed them.
    /// <para>
    /// Unlike <see cref="DeleteByPublicUrl"/>, which is deliberately origin-agnostic so an orphaned
    /// file stored under an older origin still gets cleaned up, this is origin-<em>strict</em>:
    /// accepting any host that happens to serve a matching path would defeat the whole check.
    /// A relative path is accepted because that is how the app stores what
    /// <see cref="UploadAsync"/> returned; an absolute URL must carry this engine's own origin,
    /// which is what <c>Storage:PublicBaseUrl</c> exists to declare per environment.
    /// </para>
    /// <para>
    /// Origin alone is not ownership: the path has to be the one
    /// <see cref="ProfilePhotoDirectory"/> gives <paramref name="ownerId"/>.
    /// </para>
    /// </summary>
    public virtual bool IsOwnedPublicUrl(string? url, Guid ownerId)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        var basePath = Uri.TryCreate(_publicBaseUrl, UriKind.Absolute, out var parsedBase)
            ? parsedBase.AbsolutePath
            : _publicBaseUrl;

        string path;
        // A leading slash is a site-relative path. It is checked before Uri.TryCreate because on
        // Unix that call happily parses "/uploads/a.jpg" as a file: URI, which would then be
        // rejected as a foreign scheme.
        if (url.StartsWith('/'))
        {
            path = url;
        }
        else
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var absolute)) return false;
            if (absolute.Scheme != Uri.UriSchemeHttp && absolute.Scheme != Uri.UriSchemeHttps) return false;
            if (parsedBase is null || !string.Equals(absolute.Authority, parsedBase.Authority, StringComparison.OrdinalIgnoreCase))
                return false;
            path = absolute.AbsolutePath;
        }

        var marker = '/' + basePath.Trim('/') + '/';
        if (!path.StartsWith(marker, StringComparison.Ordinal)) return false;

        var relative = Uri.UnescapeDataString(path[marker.Length..]).TrimStart('/');
        // Must name a bucket and a file within it, and must not climb out of the uploads root.
        var separator = relative.IndexOf('/');
        if (separator <= 0 || separator == relative.Length - 1) return false;
        if (ResolveWithinRoot(relative[..separator], relative[(separator + 1)..]) is null) return false;

        // And it must be a file *this* user was given. Checking only the origin meant every photo
        // URL in the discover feed was accepted onto anyone's profile: the thief wore the victim's
        // face, and dropping the stolen entry later ran the unlink in PUT /users/me against the
        // victim's real file. Matching is ordinal because this is compared against a path the
        // engine itself wrote, and a case-folded match would name a different file on Linux.
        var expected = PhotoBucket + "/" + ProfilePhotoDirectory(ownerId);
        return relative.StartsWith(expected, StringComparison.Ordinal)
            && relative.Length > expected.Length
            && !relative.AsSpan(expected.Length).Contains('/');
    }

    /// <summary>
    /// The bucket-and-path this URL names beneath the uploads root, or null when it names nothing
    /// this service stores. Origin-agnostic on purpose: <c>Storage:PublicBaseUrl</c> legitimately
    /// differs per environment (localhost, the LAN IP used for on-device testing, the production
    /// domain), and a file recorded under an older origin is still the same file on disk. Anything
    /// that must also prove *whose* file it is uses <see cref="IsOwnedPublicUrl"/> instead.
    /// </summary>
    public virtual string? RelativePathOf(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        var path = Uri.TryCreate(url, UriKind.Absolute, out var parsed) ? parsed.AbsolutePath : url;
        var basePath = Uri.TryCreate(_publicBaseUrl, UriKind.Absolute, out var parsedBase)
            ? parsedBase.AbsolutePath
            : _publicBaseUrl;
        var marker = '/' + basePath.Trim('/') + '/';

        var at = path.IndexOf(marker, StringComparison.Ordinal);
        if (at < 0) return null;

        var relative = Uri.UnescapeDataString(path[(at + marker.Length)..]).TrimStart('/');
        if (relative.Length == 0) return null;

        var separator = relative.IndexOf('/');
        if (separator <= 0 || separator == relative.Length - 1) return null;
        return ResolveWithinRoot(relative[..separator], relative[(separator + 1)..]) is null ? null : relative;
    }

    private const string SealedPrefix = "sealed-";
    private const string LegacySealedSuffix = "-sealed";

    [GeneratedRegex("^sealed-[0-9a-f]{32}\\.jpg$")]
    private static partial Regex SealedFileName();

    private static string DirectoryOf(string relativePath) =>
        Path.GetDirectoryName(relativePath)?.Replace(Path.DirectorySeparatorChar, '/') ?? "";

    private static string InDirectory(string dir, string fileName) => dir.Length > 0 ? $"{dir}/{fileName}" : fileName;

    /// <summary>
    /// The path of a stored file's sealed sibling: same directory, always <c>.jpg</c>
    /// (<see cref="PhotoCompressionService.SealAsync"/> always re-encodes as JPEG), named by a keyed
    /// MAC of the original's filename. The name used to be the original's plus <c>-sealed</c>, so
    /// every stranger handed a sealed URL in the discover feed could strip the suffix and fetch the
    /// unblurred original from the same public directory. Only the filename feeds the MAC, so this
    /// works equally on a bucket-relative <c>path</c> (the shape <see cref="UploadAsync"/> takes)
    /// and on the bucket-prefixed relative path <see cref="EnumerateProfilePhotos"/> returns.
    /// </summary>
    public string SealedPathOf(string relativePath)
    {
        var name = Path.GetFileNameWithoutExtension(relativePath);
        var mac = HMACSHA256.HashData(_sealKey, Encoding.UTF8.GetBytes(name));
        return InDirectory(DirectoryOf(relativePath), $"{SealedPrefix}{Convert.ToHexString(mac, 0, 16).ToLowerInvariant()}.jpg");
    }

    /// <summary>The pre-MAC sealed name (<c>{original}-sealed.jpg</c>), kept only so it can be cleaned up.</summary>
    private static string LegacySealedPathOf(string relativePath) =>
        InDirectory(DirectoryOf(relativePath), $"{Path.GetFileNameWithoutExtension(relativePath)}{LegacySealedSuffix}.jpg");

    /// <summary>
    /// True for a sealed variant under either naming scheme. The maintenance sweep uses it to tell
    /// sealed files apart from originals: a sealed file is never itself sealed, and a legacy one —
    /// whose name gives its original away — is left for the orphan sweep to remove.
    /// </summary>
    public static bool IsSealedPath(string relativePath)
    {
        var fileName = Path.GetFileName(relativePath);
        return SealedFileName().IsMatch(fileName)
            || Path.GetFileNameWithoutExtension(fileName).EndsWith(LegacySealedSuffix, StringComparison.Ordinal);
    }

    /// <summary>
    /// The relative path of the original a sealed file belongs to, in the same shape it was given.
    /// A MAC cannot be inverted, so this looks for the original among the files actually beside it
    /// — one profile directory holds a handful. Null when <paramref name="relativePath"/> is not a
    /// sealed file, when its original is gone, and for a legacy-named sealed file: those have no
    /// owner worth keeping them for, because their name is exactly the leak the MAC closes.
    /// </summary>
    public virtual string? OriginalPathOfSealed(string relativePath)
    {
        if (!SealedFileName().IsMatch(Path.GetFileName(relativePath))) return null;

        var separator = relativePath.IndexOf('/');
        if (separator <= 0) return null;
        var fullPath = ResolveWithinRoot(relativePath[..separator], relativePath[(separator + 1)..]);
        var directory = fullPath is null ? null : Path.GetDirectoryName(fullPath);
        if (directory is null || !Directory.Exists(directory)) return null;

        var dir = DirectoryOf(relativePath);
        var sealedName = Path.GetFileName(relativePath);
        foreach (var candidate in Directory.EnumerateFiles(directory))
        {
            var candidateName = Path.GetFileName(candidate);
            if (IsSealedPath(candidateName)) continue;
            if (Path.GetFileName(SealedPathOf(candidateName)) == sealedName) return InDirectory(dir, candidateName);
        }
        return null;
    }

    private bool ExistsWithinRoot(string relativePath)
    {
        var separator = relativePath.IndexOf('/');
        if (separator <= 0) return false;
        var fullPath = ResolveWithinRoot(relativePath[..separator], relativePath[(separator + 1)..]);
        return fullPath is not null && File.Exists(fullPath);
    }

    /// <summary>True when the sealed sibling of the stored file at this relative path exists on disk.</summary>
    public virtual bool SealedVariantExists(string relativePath) => ExistsWithinRoot(SealedPathOf(relativePath));

    /// <summary>
    /// The public URL of the public URL <paramref name="url"/> names' sealed sibling — only when
    /// that sibling actually exists on disk, which is exactly the "has this candidate's photo been
    /// sealed yet" the discover feed needs to answer. A freshly uploaded photo has no sealed
    /// sibling until the upload hook (or the backfill sweep, for anything uploaded before this
    /// feature shipped) has produced one, so returning a URL unconditionally would 404.
    /// </summary>
    public virtual string? SealedPublicUrlOf(string? url)
    {
        var relative = RelativePathOf(url);
        if (relative is null) return null;
        return SealedVariantExists(relative) ? $"{_publicBaseUrl}/{SealedPathOf(relative)}" : null;
    }

    /// <summary>Reads a stored file's bytes given the bucket-prefixed relative path <see cref="EnumerateProfilePhotos"/> returns.</summary>
    public virtual async Task<byte[]?> ReadByRelativePathAsync(string relativePath)
    {
        var separator = relativePath.IndexOf('/');
        if (separator <= 0) return null;
        var fullPath = ResolveWithinRoot(relativePath[..separator], relativePath[(separator + 1)..]);
        if (fullPath is null || !File.Exists(fullPath)) return null;
        return await File.ReadAllBytesAsync(fullPath);
    }

    public virtual bool DeleteByPublicUrl(string? url)
    {
        var relative = RelativePathOf(url);
        if (relative is null) return false;

        var separator = relative.IndexOf('/');
        var fullPath = ResolveWithinRoot(relative[..separator], relative[(separator + 1)..])!;

        // The sealed sibling has no row pointing at it — SealedPhotoUrl is derived on read, never
        // stored — so nothing else will ever clean it up once the original it belongs to is gone.
        // File.Delete is a silent no-op when the target does not exist, which is the common case
        // (a business photo, say, has no sibling at all). A legacy-named sibling from before sealed
        // names were keyed goes too.
        foreach (var sealedRelative in new[] { SealedPathOf(relative), LegacySealedPathOf(relative) })
        {
            var sealedSeparator = sealedRelative.IndexOf('/');
            if (sealedSeparator > 0
                && ResolveWithinRoot(sealedRelative[..sealedSeparator], sealedRelative[(sealedSeparator + 1)..]) is { } sealedFullPath)
            {
                try { File.Delete(sealedFullPath); }
                catch (Exception ex) { _logger.LogWarning(ex, "Could not delete sealed sibling for {Url}", url); }
            }
        }

        try
        {
            if (!File.Exists(fullPath))
            {
                _logger.LogWarning("No stored file to delete for {Url}", url);
                return false;
            }
            File.Delete(fullPath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete stored file for {Url}", url);
            return false;
        }
    }

    /// <summary>
    /// Every profile photo currently on disk, as (relative path, last-write time). Used by the
    /// maintenance sweep to find files no row points at: an upload is issued the moment a photo is
    /// picked, so every abandoned edit, failed save and removed-before-saving photo leaves a file
    /// behind on a path that is public and unauthenticated forever.
    /// <para>
    /// Relative paths, not URLs, because the two sides of that comparison can carry different
    /// origins — see <see cref="RelativePathOf"/>. Matching on the full URL would classify a live
    /// photo stored under an older origin as an orphan and delete it.
    /// </para>
    /// </summary>
    public virtual IReadOnlyList<(string RelativePath, DateTime LastWriteUtc)> EnumerateProfilePhotos()
    {
        var bucketRoot = Path.Combine(_root, PhotoBucket, "profiles");
        if (!Directory.Exists(bucketRoot)) return [];

        var results = new List<(string, DateTime)>();
        foreach (var file in Directory.EnumerateFiles(bucketRoot, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(_root, file).Replace(Path.DirectorySeparatorChar, '/');
            try
            {
                results.Add((relative, File.GetLastWriteTimeUtc(file)));
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // Raced with a delete, or unreadable. Skipping is right: an orphan sweep must
                // never be the thing that takes the whole maintenance pass down.
                _logger.LogWarning(ex, "Could not stat stored file {Path}", relative);
            }
        }
        return results;
    }

    /// <summary>Deletes one file named by the relative path <see cref="EnumerateProfilePhotos"/> returns.</summary>
    public virtual bool DeleteByRelativePath(string relativePath)
    {
        var separator = relativePath.IndexOf('/');
        if (separator <= 0 || separator == relativePath.Length - 1) return false;
        var fullPath = ResolveWithinRoot(relativePath[..separator], relativePath[(separator + 1)..]);
        if (fullPath is null) return false;
        try
        {
            if (!File.Exists(fullPath)) return false;
            File.Delete(fullPath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete orphaned file {Path}", relativePath);
            return false;
        }
    }
}
