using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("photos")]
[Authorize]
[Produces("application/json")]
public class PhotosController : ControllerBase
{
    private const long MaxUploadBytes = 15 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
    };

    private readonly PhotoCompressionService _compression;
    private readonly LocalFileStorageService _storage;

    public PhotosController(PhotoCompressionService compression, LocalFileStorageService storage)
    {
        _compression = compression;
        _storage = storage;
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PhotoUploadResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file.Length == 0) return this.BadRequestError("No file provided");
        if (file.Length > MaxUploadBytes) return this.BadRequestError("Photo is too large");
        if (!AllowedContentTypes.Contains(file.ContentType))
            return this.BadRequestError("Unsupported file type");

        byte[] compressed;
        try
        {
            await using var stream = file.OpenReadStream();
            compressed = await _compression.CompressAsync(stream);
        }
        catch (Exception)
        {
            return this.BadRequestError("Could not read this file as an image");
        }

        var userId = this.CurrentUserId();
        var path = $"profiles/{userId}/{Guid.NewGuid():N}.jpg";
        var url = await _storage.UploadAsync("photos", path, compressed, "image/jpeg");

        return Ok(new PhotoUploadResponse(url));
    }
}

public record PhotoUploadResponse(string Url);
