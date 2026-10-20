using MinglDingl.Engine.Kernel.Errors;
using SkiaSharp;

namespace MinglDingl.Engine.Features.Photos;

/// face: whether a human face was found (null when the caller did not ask).
public sealed record ProcessedImage(byte[] Jpeg, int Width, int Height, byte[] ThumbHash, bool? Face = null);

/// Every upload is re-encoded: turned upright, capped at 1600 px, JPEG q82. Re-encoding drops
/// every metadata block (EXIF, GPS, ICC, XMP) — nothing about where or how it was taken survives.
public static class ImagePipeline
{
    public const int MaxSide = 1600;
    public const long MaxPixels = 50_000_000;

    public static ProcessedImage Process(byte[] input, bool findFace = false)
    {
        using var data = SKData.CreateCopy(input);
        using var codec = SKCodec.Create(data)
            ?? throw new DomainException(400, "photos.not_image", "That file is not a photo");
        if ((long)codec.Info.Width * codec.Info.Height > MaxPixels)
            throw new DomainException(400, "photos.too_large", "That photo is too large");

        using var decoded = SKBitmap.Decode(codec)
            ?? throw new DomainException(400, "photos.not_image", "That file is not a photo");
        using var upright = Orient(decoded, codec.EncodedOrigin);

        var scale = Math.Min(1.0, MaxSide / (double)Math.Max(upright.Width, upright.Height));
        var w = Math.Max(1, (int)Math.Round(upright.Width * scale));
        var h = Math.Max(1, (int)Math.Round(upright.Height * scale));
        using var sized = scale < 1.0 ? Resize(upright, w, h) : upright.Copy();

        using var image = SKImage.FromBitmap(sized);
        using var jpeg = image.Encode(SKEncodedImageFormat.Jpeg, 82);
        return new ProcessedImage(jpeg.ToArray(), sized.Width, sized.Height, Hash(sized), findFace ? FaceFinder.HasFace(sized) : null);
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
