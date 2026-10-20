using FluentAssertions;
using MinglDingl.Engine.Features.Photos;
using SkiaSharp;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class OrientationTests
{
    [Fact]
    public void A_phone_photo_taken_sideways_is_stored_upright()
    {
        // 40×20, red left half, blue right half, tagged "rotate 90° clockwise" (EXIF 6) as a phone held sideways writes it.
        var processed = ImagePipeline.Process(WithOrientation(HalvesJpeg(40, 20), 6));

        processed.Width.Should().Be(20);
        processed.Height.Should().Be(40);
        using var upright = SKBitmap.Decode(processed.Jpeg);
        IsRed(upright.GetPixel(10, 5)).Should().BeTrue("the left edge turns to the top");
        IsRed(upright.GetPixel(10, 34)).Should().BeFalse("the right edge turns to the bottom");
    }

    private static bool IsRed(SKColor c) => c.Red > 200 && c.Blue < 60;

    private static byte[] HalvesJpeg(int w, int h)
    {
        using var bitmap = new SKBitmap(w, h);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.Blue);
            using var red = new SKPaint { Color = SKColors.Red };
            canvas.DrawRect(0, 0, w / 2f, h, red);
        }
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(SKEncodedImageFormat.Jpeg, 95).ToArray();
    }

    /// Inserts a minimal EXIF block (one tag: Orientation) right after the JPEG's start marker.
    private static byte[] WithOrientation(byte[] jpeg, ushort orientation)
    {
        byte[] tiff =
        [
            (byte)'I', (byte)'I', 42, 0, 8, 0, 0, 0, // little-endian header, first IFD at 8
            1, 0,                                     // one entry
            0x12, 0x01, 3, 0, 1, 0, 0, 0,             // tag 0x0112 Orientation, SHORT, count 1
            (byte)orientation, (byte)(orientation >> 8), 0, 0,
            0, 0, 0, 0,                               // no next IFD
        ];
        byte[] exif = [.. "Exif\0\0"u8, .. tiff];
        var length = exif.Length + 2;
        return [jpeg[0], jpeg[1], 0xFF, 0xE1, (byte)(length >> 8), (byte)length, .. exif, .. jpeg[2..]];
    }
}
