using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;

namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// The blur and resize themselves live on <see cref="PhotoCompressionService.SealAsync"/> — that
/// is what a candidate's photo actually goes through, so its pixel-level behaviour is asserted
/// here directly. <see cref="SealedPhotoService"/> is the thin orchestration around it (read an
/// original by path, seal it, store the result beside it), exercised end to end below.
/// </summary>
public class SealedPhotoServiceTests : IDisposable
{
    private readonly string _tempRoot =
        Path.Combine(Path.GetTempPath(), "mingldingl-sealed-tests", Guid.NewGuid().ToString("N"));

    private static byte[] SolidColorJpeg(int width, int height)
    {
        using var image = new Image<Rgba32>(width, height, new Rgba32(200, 40, 40));
        using var ms = new MemoryStream();
        image.SaveAsJpeg(ms, new JpegEncoder { Quality = 90 });
        return ms.ToArray();
    }

    private LocalFileStorageService BuildStorage()
    {
        var env = new Mock<IWebHostEnvironment>();
        env.Setup(e => e.ContentRootPath).Returns(_tempRoot);
        var config = new ConfigurationBuilder().Build();
        return new LocalFileStorageService(env.Object, config, NullLogger<LocalFileStorageService>.Instance);
    }

    [Fact]
    public async Task SealAsync_ProducesADecodableJpegNoLargerThan320OnTheLongSide()
    {
        var compression = new PhotoCompressionService();
        var original = SolidColorJpeg(64, 64);

        var sealedBytes = await compression.SealAsync(original);

        using var decoded = await Image.LoadAsync(new MemoryStream(sealedBytes));
        var format = await Image.DetectFormatAsync(new MemoryStream(sealedBytes));
        Assert.Equal("JPEG", format!.Name);
        Assert.True(decoded.Width <= 320 && decoded.Height <= 320);
    }

    [Fact]
    public async Task SealAsync_CapsALargeOriginalDownTo320OnTheLongSide()
    {
        var compression = new PhotoCompressionService();
        var original = SolidColorJpeg(1200, 800);

        var sealedBytes = await compression.SealAsync(original);

        using var decoded = await Image.LoadAsync(new MemoryStream(sealedBytes));
        Assert.Equal(320, decoded.Width);
        Assert.True(decoded.Height <= 320);
    }

    [Fact]
    public async Task SealedPhotoService_GivenTheCompressedBytesDirectly_StoresTheSealedVariantBeside()
    {
        var storage = BuildStorage();
        var compression = new PhotoCompressionService();
        var service = new SealedPhotoService(compression, storage);
        var bytes = SolidColorJpeg(64, 64);
        var relativePath = "photos/u1/a.jpg";
        await storage.UploadAsync("photos", "u1/a.jpg", bytes, "image/jpeg");

        await service.SealAsync(relativePath, bytes);

        Assert.True(storage.SealedVariantExists(relativePath));
    }

    [Fact]
    public async Task SealedPhotoService_GivenOnlyAPath_ReadsTheOriginalOffDiskAndSealsIt()
    {
        var storage = BuildStorage();
        var compression = new PhotoCompressionService();
        var service = new SealedPhotoService(compression, storage);
        var bytes = SolidColorJpeg(64, 64);
        await storage.UploadAsync("photos", "u1/a.jpg", bytes, "image/jpeg");

        // No compressedOriginal supplied: this is the backfill sweep's path, which only knows the
        // location of an original uploaded before sealing existed.
        await service.SealAsync("photos/u1/a.jpg");

        Assert.True(storage.SealedVariantExists("photos/u1/a.jpg"));
    }

    [Fact]
    public async Task SealedPhotoService_NoOriginalOnDisk_Throws()
    {
        var storage = BuildStorage();
        var service = new SealedPhotoService(new PhotoCompressionService(), storage);

        await Assert.ThrowsAsync<FileNotFoundException>(() => service.SealAsync("photos/u1/missing.jpg"));
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempRoot)) Directory.Delete(_tempRoot, recursive: true);
    }
}
