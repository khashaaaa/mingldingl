using FluentAssertions;
using MinglDingl.Engine.Features.Photos;
using SkiaSharp;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class FaceMatcherTests
{
    private static FaceMatcher.Face Read(string file)
    {
        using var photo = SKBitmap.Decode(Path.Combine(AppContext.BaseDirectory, "Seed/crowd", file));
        return FaceMatcher.Read(photo) ?? throw new InvalidOperationException($"no face in {file}");
    }

    /// OpenCV's FaceDetectorYN + FaceRecognizerSF on the same photos at full size gave these cosine
    /// scores. YuNet's input here is a fixed 640 px, which places the five points a little less
    /// precisely (OpenCV itself loses up to ~0.06 at that size), hence the margin.
    [Theory]
    [InlineData("p23_1.jpg", "p23_3.jpg", 0.679f)]
    [InlineData("p02_2.jpg", "p02_3.jpg", 0.708f)]
    [InlineData("p03_0.jpg", "p03_2.jpg", 0.378f)]
    [InlineData("p02_0.jpg", "p02_3.jpg", 0.495f)]
    public void Scores_match_opencvs(string a, string b, float expected)
    {
        FaceMatcher.Similarity(Read(a).Embedding, Read(b).Embedding).Should().BeApproximately(expected, 0.08f);
    }

    [Fact]
    public void A_photo_is_its_own_closest_match_and_a_mirror_turns_the_other_way()
    {
        var face = Read("p23_1.jpg");
        FaceMatcher.Similarity(face.Embedding, face.Embedding).Should().BeApproximately(1f, 0.001f);

        using var src = SKBitmap.Decode(Path.Combine(AppContext.BaseDirectory, "Seed/crowd/p23_1.jpg"));
        using var mirrored = new SKBitmap(src.Width, src.Height);
        using (var canvas = new SKCanvas(mirrored))
        using (var image = SKImage.FromBitmap(src))
        {
            canvas.Scale(-1, 1, src.Width / 2f, 0);
            canvas.DrawImage(image, 0, 0, SKSamplingOptions.Default);
        }
        var flipped = FaceMatcher.Read(mirrored)!;
        flipped.Turn.Should().BeApproximately(-face.Turn, 0.05f);
        FaceMatcher.Similarity(face.Embedding, flipped.Embedding).Should().BeGreaterThan(0.6f);
    }

    [Fact]
    public void A_plain_field_has_no_face()
    {
        using var bmp = new SKBitmap(600, 800);
        using (var canvas = new SKCanvas(bmp)) canvas.Clear(new SKColor(90, 140, 210));
        FaceMatcher.Read(bmp).Should().BeNull();
    }
}
