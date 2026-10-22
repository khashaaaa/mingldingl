using MinglDingl.Engine.Kernel.Errors;
using SkiaSharp;

namespace MinglDingl.Engine.Features.Photos;

/// face: whether a human face was found (null when the caller did not ask). sameHash: see SameHash.
public sealed record ProcessedImage(byte[] Jpeg, int Width, int Height, byte[] ThumbHash, long SameHash, bool? Face = null);

/// Every upload is re-encoded: turned upright, capped at 1600 px, JPEG q82. Re-encoding drops
/// every metadata block (EXIF, GPS, ICC, XMP) — nothing about where or how it was taken survives.
public static class ImagePipeline
{
    public const int MaxSide = 1600;
    /// Pixels one decode may hold (64 MB at four bytes each). It bounds what is decoded, not the file:
    /// a phone's 50–200 MP JPEG original decodes at 1/2–1/8 straight from the codec and passes.
    public const long MaxPixels = 16_000_000;

    /// At most three photos in memory at once: a burst of uploads queues here instead of each holding
    /// a full decode.
    private static readonly SemaphoreSlim Turns = new(3);

    public static ProcessedImage Process(byte[] input, bool findFace = false)
    {
        Turns.Wait();
        try { return ProcessOne(input, findFace); }
        finally { Turns.Release(); }
    }

    private static ProcessedImage ProcessOne(byte[] input, bool findFace)
    {
        using var upright = Decode(input, MaxSide);

        var scale = Math.Min(1.0, MaxSide / (double)Math.Max(upright.Width, upright.Height));
        var w = Math.Max(1, (int)Math.Round(upright.Width * scale));
        var h = Math.Max(1, (int)Math.Round(upright.Height * scale));
        using var sized = scale < 1.0 ? Resize(upright, w, h) : upright.Copy();

        using var image = SKImage.FromBitmap(sized);
        using var jpeg = image.Encode(SKEncodedImageFormat.Jpeg, 82);
        return new ProcessedImage(jpeg.ToArray(), sized.Width, sized.Height, Hash(sized), SameHash(sized),
            findFace ? FaceFinder.HasFace(sized) : null);
    }

    /// A 64-bit difference hash of the picture's brightness (9×8 box-averaged cells, each bit "is the
    /// next cell to the right brighter"). The same photo sent again — re-encoded, resized, screenshotted
    /// — lands within a few bits of the first; two different photos differ by about half of them.
    public static long SameHash(SKBitmap source)
    {
        using var copy = source.ColorType == SKColorType.Rgba8888 ? null : source.Copy(SKColorType.Rgba8888);
        var bitmap = copy ?? source;
        var px = bitmap.GetPixelSpan();
        int w = bitmap.Width, h = bitmap.Height, stride = bitmap.RowBytes;
        var sum = new double[8, 9];
        var count = new int[8, 9];
        for (var y = 0; y < h; y++)
        {
            var cy = y * 8 / h;
            for (var x = 0; x < w; x++)
            {
                var cx = x * 9 / w;
                var i = y * stride + x * 4;
                sum[cy, cx] += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                count[cy, cx]++;
            }
        }
        long bits = 0;
        for (var cy = 0; cy < 8; cy++)
            for (var cx = 0; cx < 8; cx++)
                bits = (bits << 1) | (sum[cy, cx] / Math.Max(1, count[cy, cx]) < sum[cy, cx + 1] / Math.Max(1, count[cy, cx + 1]) ? 1L : 0L);
        return bits;
    }

    /// The photo's pixels, turned upright by its EXIF orientation, decoded no larger than needed for
    /// a long side of `atLeast` (still larger only when the codec cannot scale finer).
    public static SKBitmap DecodeUpright(byte[] input, int atLeast = MaxSide)
    {
        Turns.Wait();
        try { return Decode(input, atLeast); }
        finally { Turns.Release(); }
    }

    private static SKBitmap Decode(byte[] input, int atLeast)
    {
        using var data = SKData.CreateCopy(input);
        using var codec = SKCodec.Create(data)
            ?? throw new DomainException(400, "photos.not_image", "That file is not a photo");
        var size = ScaledSize(codec, atLeast);
        if ((long)size.Width * size.Height > MaxPixels)
            throw new DomainException(400, "photos.too_large", "That photo is too large");

        var info = codec.Info.WithSize(size);
        if (info.AlphaType == SKAlphaType.Unpremul) info.AlphaType = SKAlphaType.Premul;
        using var decoded = SKBitmap.Decode(codec, info)
            ?? throw new DomainException(400, "photos.not_image", "That file is not a photo");
        return Orient(decoded, codec.EncodedOrigin);
    }

    /// The smallest size the codec decodes to natively (JPEG by eighths, WebP freely, PNG only whole)
    /// whose long side still reaches `atLeast`.
    private static SKSizeI ScaledSize(SKCodec codec, int atLeast)
    {
        var full = codec.Info.Size;
        for (var eighths = 1; eighths < 8; eighths++)
        {
            var size = codec.GetScaledDimensions(eighths / 8f);
            if (size.Width > 0 && size.Height > 0 && Math.Max(size.Width, size.Height) >= atLeast) return size;
        }
        return full;
    }

    private static byte[] Hash(SKBitmap source)
    {
        var s = Math.Min(1.0, 100.0 / Math.Max(source.Width, source.Height));
        var w = Math.Max(1, (int)Math.Round(source.Width * s));
        var h = Math.Max(1, (int)Math.Round(source.Height * s));
        using var small = Resize(source, w, h, SKColorType.Rgba8888, SKAlphaType.Unpremul);
        return ThumbHash.FromRgba(w, h, small.GetPixelSpan());
    }

    private static SKBitmap Resize(SKBitmap src, int w, int h, SKColorType? type = null, SKAlphaType? alpha = null)
    {
        var info = new SKImageInfo(w, h, type ?? src.ColorType, alpha ?? src.AlphaType);
        return src.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell))
            ?? throw new DomainException(400, "photos.not_image", "That photo could not be read");
    }

    /// Applies the EXIF orientation by drawing, so the stored pixels are upright and need no tag.
    private static SKBitmap Orient(SKBitmap src, SKEncodedOrigin origin)
    {
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var w = swap ? src.Height : src.Width;
        var h = swap ? src.Width : src.Height;
        var dst = new SKBitmap(new SKImageInfo(w, h, src.ColorType, src.AlphaType));
        using var canvas = new SKCanvas(dst);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight: canvas.Scale(-1, 1, w / 2f, 0); break;
            case SKEncodedOrigin.BottomRight: canvas.RotateDegrees(180, w / 2f, h / 2f); break;
            case SKEncodedOrigin.BottomLeft: canvas.Scale(1, -1, 0, h / 2f); break;
            case SKEncodedOrigin.LeftTop: canvas.Translate(0, 0); canvas.Scale(-1, 1, w / 2f, 0); canvas.RotateDegrees(90); canvas.Translate(0, -w); break;
            case SKEncodedOrigin.RightTop: canvas.Translate(w, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.RightBottom: canvas.Translate(w, h); canvas.Scale(-1, 1); canvas.Translate(w, 0); canvas.RotateDegrees(90); canvas.Translate(-w, -h); break;
            case SKEncodedOrigin.LeftBottom: canvas.Translate(0, h); canvas.RotateDegrees(270); break;
        }
        using var image = SKImage.FromBitmap(src);
        canvas.DrawImage(image, 0, 0, SKSamplingOptions.Default);
        return dst;
    }
}
