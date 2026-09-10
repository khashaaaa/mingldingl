using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("photos")]
[Authorize]
[Produces("application/json")]
public class PhotosController : ControllerBase
{
    private const long MaxUploadBytes = 15 * 1024 * 1024;

    // Only what SixLabors.ImageSharp can actually decode. HEIC/HEIF were advertised here and
    // always failed at the decode below with "Could not read this file as an image", which reads
    // as a corrupt file rather than an unsupported one. iOS hands us JPEG anyway
    // (`preferredAssetRepresentationMode: Compatible`), and Android re-encodes on `quality`.
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp",
    };

    private readonly PhotoCompressionService _compression;
    private readonly LocalFileStorageService _storage;
    private readonly PhotoUploadThrottleService _throttle;

    public PhotosController(
        PhotoCompressionService compression,
        LocalFileStorageService storage,
        PhotoUploadThrottleService throttle)
    {
        _compression = compression;
        _storage = storage;
        _throttle = throttle;
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PhotoUploadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status429TooManyRequests)]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> Upload(IFormFile? file)
    {
        // Nullable on purpose: a multipart body with no `file` part binds null, and reading .Length
        // on it turned a malformed request into a logged 500 instead of the 400 documented above.
        if (file is null || file.Length == 0) return this.BadRequestError("No file provided", "photo.none_provided");
        if (file.Length > MaxUploadBytes) return this.BadRequestError("Photo is too large", "photo.too_large");
        if (!AllowedContentTypes.Contains(file.ContentType))
            return this.BadRequestError("Unsupported file type", "photo.unsupported_type");

        var userId = this.CurrentUserId();

        // Decoding is the expensive part of this endpoint and it is entirely attacker-paced, so the
        // gate goes before it. Without one, a single account could hold the whole ImageSharp
        // working set open in a loop, and fill a public disk 15MB at a time.
        if (!_throttle.TryTake(userId))
            return this.TooManyRequestsError("Too many photo uploads. Try again shortly.", "photo.too_many_uploads");

        byte[] compressed;
        try
        {
            await using var stream = file.OpenReadStream();
            compressed = await _compression.CompressAsync(stream);
        }
        catch (ImageTooLargeException)
        {
            return this.BadRequestError("Photo dimensions are too large", "photo.dimensions_too_large");
        }
        catch (Exception)
        {
            return this.BadRequestError("Could not read this file as an image", "photo.unreadable");
        }

        var path = $"{LocalFileStorageService.ProfilePhotoDirectory(userId)}{Guid.NewGuid():N}.jpg";
        var url = await _storage.UploadAsync(LocalFileStorageService.PhotoBucket, path, compressed, "image/jpeg");

        return Ok(new PhotoUploadResponse(url));
    }
}

public record PhotoUploadResponse(string Url);
