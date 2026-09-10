using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

/// <summary>An image whose declared pixel count is too large to decode. Not a corrupt file.</summary>
public class ImageTooLargeException : Exception
{
    public ImageTooLargeException(long pixels)
        : base($"Image declares {pixels} pixels, above the decode limit") { }
}

public class PhotoCompressionService
{
    private const int MaxDimension = 1600;
    private const int JpegQuality = 80;

    /// <summary>
    /// Ceiling on the pixels this will decode — roughly a 60-megapixel photo, comfortably above any
    /// phone camera. ImageSharp allocates width × height × bytes-per-pixel *before* anything here
    /// gets to downscale, so the file size cap alone is no protection: a ~1MB PNG can legally
    /// declare 30000×30000 and take the process to several GB. The header is read first and the
    /// pixels are never touched when the answer is no.
    /// </summary>
    private const long MaxPixels = 60_000_000;

    public async Task<byte[]> CompressAsync(Stream input)
    {
        using var buffered = new MemoryStream();
        await input.CopyToAsync(buffered);
        buffered.Position = 0;

        var info = await Image.IdentifyAsync(buffered);
        long pixels = (long)info.Width * info.Height;
        if (pixels > MaxPixels) throw new ImageTooLargeException(pixels);
        buffered.Position = 0;

        using var image = await Image.LoadAsync(buffered);

        if (image.Width > MaxDimension || image.Height > MaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(MaxDimension, MaxDimension),
            }));
        }

        using var clean = image.CloneAs<Rgb24>();
        using var output = new MemoryStream();
        await clean.SaveAsync(output, new JpegEncoder { Quality = JpegQuality });
        return output.ToArray();
    }
}
