using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;

namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// ImageSharp allocates width × height × bytes-per-pixel before anything gets to downscale, so the
/// 15MB request cap alone is no protection: a highly compressible PNG declaring an enormous canvas
/// takes the process to several GB. The header is read first and the pixels are never touched when
/// the answer is no.
/// </summary>
public class PhotoCompressionLimitTests
{
    private static byte[] BlankPng(int width, int height)
    {
        using var image = new Image<Rgba32>(width, height);
        using var output = new MemoryStream();
        image.Save(output, new PngEncoder());
        return output.ToArray();
    }

    [Fact]
    public async Task AnOrdinaryPhoto_IsCompressed()
    {
        var bytes = BlankPng(2400, 1800);
        using var input = new MemoryStream(bytes);

        var result = await new PhotoCompressionService().CompressAsync(input);

        using var decoded = Image.Load(result);
        Assert.True(decoded.Width <= 1600 && decoded.Height <= 1600);
    }

    [Fact]
    public async Task ACanvasAboveThePixelCeiling_IsRefusedWithoutDecoding()
    {
        // ~90 megapixels of empty canvas: a few hundred KB on the wire, gigabytes decoded.
        var bytes = BlankPng(12_000, 7_500);
        using var input = new MemoryStream(bytes);

        await Assert.ThrowsAsync<ImageTooLargeException>(
            () => new PhotoCompressionService().CompressAsync(input));
    }
}
