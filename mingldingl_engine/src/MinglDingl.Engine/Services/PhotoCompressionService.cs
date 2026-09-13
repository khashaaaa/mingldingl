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

    /// <summary>Long side of a sealed variant — small enough that a blur is the only thing to see, not a size to squint at.</summary>
    private const int SealedMaxDimension = 320;

    /// <summary>Gaussian sigma the sealed variant is blurred at. Chosen to erase individual features, not just soften them.</summary>
    private const int SealedBlurSigma = 18;

    private const int SealedJpegQuality = 60;

    /// <summary>
    /// Produces the small, blurred "sealed" variant candidates are actually served — the thesis is
    /// "faces are earned," so an unearned likeness must never leave the engine at full size or in
    /// focus. Takes bytes already decodable as an image (in practice, <see cref="CompressAsync"/>'s
    /// output); never re-reads the original upload itself.
    /// </summary>
    public async Task<byte[]> SealAsync(byte[] jpeg)
    {
        using var image = await Image.LoadAsync(new MemoryStream(jpeg));

        if (image.Width > SealedMaxDimension || image.Height > SealedMaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(SealedMaxDimension, SealedMaxDimension),
            }));
        }

        // Blurred after the resize, not before: blurring at full size first only to throw most of
        // it away at resize is wasted work, and resizing a blur can reintroduce a bit of edge.
        //
        // ImageSharp's Gaussian kernel grows with sigma and throws once it no longer fits the
        // image (empirically, somewhere past sigma ≈ dimension / 4) — every real, camera-sized
        // photo clears that by a wide margin, but nothing upstream stops a pathologically small
        // upload, and a thrown exception here is worse for "faces are earned" than a gentler blur:
        // it would leave the photo with no sealed variant, and the app's fallback for that is no
        // photo at all, not a safe one.
        var minDimension = Math.Min(image.Width, image.Height);
        var safeSigma = Math.Clamp(SealedBlurSigma, 1, Math.Max(1, (minDimension - 1) / 4));
        image.Mutate(x => x.GaussianBlur(safeSigma));

        using var clean = image.CloneAs<Rgb24>();
        using var output = new MemoryStream();
        await clean.SaveAsync(output, new JpegEncoder { Quality = SealedJpegQuality });
        return output.ToArray();
    }

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
