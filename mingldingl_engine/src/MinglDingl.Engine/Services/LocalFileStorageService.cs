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
    public bool DeleteByPublicUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        // Match on the path beneath the uploads root, never the full origin. PublicBaseUrl
        // legitimately differs per environment (localhost, LAN IP for on-device testing, the
        // production domain), and a photo stored under an older origin must stay deletable —
        // otherwise it silently survives account deletion on a public, unauthenticated path.
        var path = Uri.TryCreate(url, UriKind.Absolute, out var parsed) ? parsed.AbsolutePath : url;
        var basePath = Uri.TryCreate(_publicBaseUrl, UriKind.Absolute, out var parsedBase)
            ? parsedBase.AbsolutePath
            : _publicBaseUrl;
        var marker = '/' + basePath.Trim('/') + '/';

        var at = path.IndexOf(marker, StringComparison.Ordinal);
        if (at < 0) return false;

        var relative = Uri.UnescapeDataString(path[(at + marker.Length)..]).TrimStart('/');
        if (relative.Length == 0) return false;

        var separator = relative.IndexOf('/');
        if (separator <= 0) return false;

        var fullPath = ResolveWithinRoot(relative[..separator], relative[(separator + 1)..]);
        if (fullPath is null) return false;

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
}
