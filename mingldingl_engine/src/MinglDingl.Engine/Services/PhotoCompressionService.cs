using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

// Every uploaded photo goes through here before it ever reaches storage —
// phone camera photos routinely run 3-8MB at 4000px+ on a side, far past
// what a profile/business card ever displays. Downscaling to a realistic
// display size and re-encoding as JPEG at a still-clean quality cuts that
// by roughly 80-95% with no visible loss at the sizes the app actually
// renders photos.
public class PhotoCompressionService
{
    private const int MaxDimension = 1600;
    private const int JpegQuality = 80;

    public async Task<byte[]> CompressAsync(Stream input)
    {
        // IFormFile's stream isn't guaranteed seekable the way a plain
        // MemoryStream is, and ImageSharp's decoder seeks while reading —
        // buffer it fully first rather than handing over the raw multipart
        // section stream.
        using var buffered = new MemoryStream();
        await input.CopyToAsync(buffered);
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

        // ImageSharp's JPEG encoder produces corrupted (tiled/repeating)
        // output when fed certain images decoded from a progressive-JPEG
        // source — confirmed independent of resizing, threading, and
        // package patch version (traced to the encoder, not the decoder:
        // saving the same in-memory buffer as PNG comes out perfect).
        // Re-materializing into a plain Rgb24 buffer before encoding sidesteps
        // whatever internal state the encoder is tripping over.
        using var clean = image.CloneAs<Rgb24>();
        using var output = new MemoryStream();
        await clean.SaveAsync(output, new JpegEncoder { Quality = JpegQuality });
        return output.ToArray();
    }
}
