using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace MinglDingl.Engine.Tests.Integration;

public class PhotosControllerIntegrationTests : IntegrationTestBase, IDisposable
{
    private readonly string _tempRoot =
        Path.Combine(Path.GetTempPath(), "mingldingl-photos-tests", Guid.NewGuid().ToString("N"));

    private PhotosController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;

        var envMock = new Mock<IWebHostEnvironment>();
        envMock.Setup(e => e.ContentRootPath).Returns(_tempRoot);

        var config = new ConfigurationBuilder().Build();
        var storage = new LocalFileStorageService(envMock.Object, config, NullLogger<LocalFileStorageService>.Instance);
        var compression = new PhotoCompressionService();

        return new PhotosController(compression, storage, new PhotoUploadThrottleService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    private static IFormFile MakeFormFile(byte[] bytes, string fileName, string contentType, long? lengthOverride = null)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, lengthOverride ?? bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };
    }

    private static byte[] MakeValidJpegBytes()
    {
        using var image = new Image<Rgba32>(24, 24);
        using var ms = new MemoryStream();
        image.SaveAsJpeg(ms);
        return ms.ToArray();
    }

    [Fact]
    public async Task Upload_NoFilePartAtAll_ReturnsBadRequestNotAServerError()
    {
        // ASP.NET binds a missing `file` part to null, and reading .Length on it made a malformed
        // request a logged 500 instead of the 400 the endpoint documents.
        var result = await BuildController(Guid.NewGuid()).Upload(null);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Upload_EmptyFile_ReturnsBadRequest()
    {
        var controller = BuildController(Guid.NewGuid());
        var file = MakeFormFile(Array.Empty<byte>(), "photo.jpg", "image/jpeg");

        var result = await controller.Upload(file);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Upload_FileOverSizeLimit_ReturnsBadRequest()
    {
        var controller = BuildController(Guid.NewGuid());

        var file = MakeFormFile(new byte[] { 1, 2, 3 }, "photo.jpg", "image/jpeg", lengthOverride: 15 * 1024 * 1024 + 1);

        var result = await controller.Upload(file);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("video/mp4")]
    [InlineData("")]
    public async Task Upload_DisallowedContentType_ReturnsBadRequest(string contentType)
    {
        var controller = BuildController(Guid.NewGuid());
        var file = MakeFormFile(new byte[] { 1, 2, 3 }, "photo.jpg", contentType);

        var result = await controller.Upload(file);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Upload_AllowedContentTypeButUndecodableBytes_ReturnsBadRequestAndDoesNotWriteFile()
    {
        var controller = BuildController(Guid.NewGuid());
        var garbage = new byte[] { 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07 };
        var file = MakeFormFile(garbage, "photo.jpg", "image/jpeg");

        var result = await controller.Upload(file);

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
        var uploadsDir = Path.Combine(_tempRoot, "uploads");
        if (Directory.Exists(uploadsDir))
        {
            Assert.Empty(Directory.EnumerateFiles(uploadsDir, "*", SearchOption.AllDirectories));
        }
    }

    [Fact]
    public async Task Upload_ValidJpeg_ReturnsOkWithUrlAndWritesCompressedFileToDisk()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);
        var bytes = MakeValidJpegBytes();
        var file = MakeFormFile(bytes, "photo.jpg", "image/jpeg");

        var result = await controller.Upload(file);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<PhotoUploadResponse>(ok.Value);
        Assert.Contains($"/photos/profiles/{userId}/", response.Url);
        Assert.EndsWith(".jpg", response.Url);

        const string marker = "/uploads/";
        var relativePath = response.Url.Substring(response.Url.IndexOf(marker, StringComparison.Ordinal) + marker.Length);
        var diskPath = Path.Combine(_tempRoot, "uploads", relativePath.Replace('/', Path.DirectorySeparatorChar));

        Assert.True(File.Exists(diskPath), $"expected compressed photo at {diskPath}");
        var written = await File.ReadAllBytesAsync(diskPath);
        Assert.NotEmpty(written);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot))
        {
            Directory.Delete(_tempRoot, recursive: true);
        }
    }
}
