using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

public class PhotoCompressionService
{
    private const int MaxDimension = 1600;
    private const int JpegQuality = 80;

    public async Task<byte[]> CompressAsync(Stream input)
    {
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

        using var clean = image.CloneAs<Rgb24>();
        using var output = new MemoryStream();
        await clean.SaveAsync(output, new JpegEncoder { Quality = JpegQuality });
        return output.ToArray();
    }
}
