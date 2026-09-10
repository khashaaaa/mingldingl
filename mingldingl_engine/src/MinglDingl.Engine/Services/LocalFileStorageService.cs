public class LocalFileStorageService
{
    private readonly string _root;
    private readonly string _publicBaseUrl;
    private readonly ILogger<LocalFileStorageService> _logger;

    public LocalFileStorageService(IWebHostEnvironment env, IConfiguration config, ILogger<LocalFileStorageService> logger)
    {
        _root = Path.GetFullPath(Path.Combine(env.ContentRootPath, "uploads"));
        _publicBaseUrl = (config["Storage:PublicBaseUrl"] ?? "http://localhost:5150/uploads").TrimEnd('/');
        _logger = logger;
        Directory.CreateDirectory(_root);
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

    public virtual bool DeleteByPublicUrl(string? url)
    {
        var relative = RelativePathOf(url);
        if (relative is null) return false;

        var separator = relative.IndexOf('/');
        var fullPath = ResolveWithinRoot(relative[..separator], relative[(separator + 1)..])!;

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
