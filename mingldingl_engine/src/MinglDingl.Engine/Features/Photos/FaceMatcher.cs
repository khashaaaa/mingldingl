using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SkiaSharp;

namespace MinglDingl.Engine.Features.Photos;

/// Whose face it is, for the selfie check: YuNet (MIT, `Models/yunet-2023mar.onnx`, 230 KB) finds the
/// face and its five points, SFace (Apache 2.0, `Models/sface-2021dec.onnx`, 37 MB) turns the face,
/// aligned on those points, into 128 numbers. The same pipeline as OpenCV's FaceDetectorYN +
/// FaceRecognizerSF, whose cosine scores it reproduces. Nothing is kept: the numbers live only for
/// the one comparison.
public static class FaceMatcher
{
    /// embedding: unit length, so two faces' similarity is their dot product (OpenCV's "same person"
    /// line on its benchmark is 0.363). turn: the nose's offset from between the eyes, in eye spans;
    /// + is towards the photo's right.
    public sealed record Face(float[] Embedding, float Turn);

    private const int Side = 640, Crop = 112;
    private const float MinScore = 0.8f;

    /// Where SFace expects the eyes, nose and mouth corners in its 112×112 crop.
    private static readonly SKPoint[] Template =
        [new(38.2946f, 51.6963f), new(73.5318f, 51.5014f), new(56.0252f, 71.7366f), new(41.5493f, 92.3655f), new(70.7299f, 92.2041f)];

    private static readonly Lazy<InferenceSession> Detector = new(() => Open("yunet-2023mar.onnx"));
    private static readonly Lazy<InferenceSession> Recogniser = new(() => Open("sface-2021dec.onnx"));
    /// The same budget as FaceFinder: at most two reads at once, one core each.
    private static readonly SemaphoreSlim Turns = new(2);

    private static InferenceSession Open(string model) =>
        new(Path.Combine(AppContext.BaseDirectory, "Models", model),
            new Microsoft.ML.OnnxRuntime.SessionOptions { IntraOpNumThreads = 1, InterOpNumThreads = 1, ExecutionMode = ExecutionMode.ORT_SEQUENTIAL });

    public static float Similarity(float[] a, float[] b)
    {
        var dot = 0f;
        for (var i = 0; i < a.Length; i++) dot += a[i] * b[i];
        return dot;
    }

    /// The largest clear face in the photo, or null when there is none.
    public static Face? Read(SKBitmap photo)
    {
        Turns.Wait();
        try
        {
            if (Landmarks(photo) is not { } points) return null;
            var eyes = (points[0].X + points[1].X) / 2;
            var span = Math.Abs(points[1].X - points[0].X);
            return new Face(Embed(photo, points), span < 1 ? 0 : (points[2].X - eyes) / span);
        }
        finally
        {
            Turns.Release();
        }
    }

    /// YuNet on the photo fitted into its 640×640 input (padded right and below, as OpenCV pads),
    /// decoded the way OpenCV's FaceDetectorYN decodes its three strides.
    private static SKPoint[]? Landmarks(SKBitmap photo)
    {
        var scale = Side / (float)Math.Max(photo.Width, photo.Height);
        using var frame = new SKBitmap(new SKImageInfo(Side, Side, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        using (var canvas = new SKCanvas(frame))
        {
            canvas.Clear(SKColors.Black);
            using var image = SKImage.FromBitmap(photo);
            canvas.DrawImage(image, SKRect.Create(photo.Width * scale, photo.Height * scale), new SKSamplingOptions(SKFilterMode.Linear));
        }

        // BGR, 0–255, no normalisation.
        var input = new DenseTensor<float>([1, 3, Side, Side]);
        var px = frame.GetPixelSpan();
        for (var y = 0; y < Side; y++)
        for (var x = 0; x < Side; x++)
        {
            var i = (y * Side + x) * 4;
            input[0, 0, y, x] = px[i + 2];
            input[0, 1, y, x] = px[i + 1];
            input[0, 2, y, x] = px[i];
        }

        var session = Detector.Value;
        using var results = session.Run([NamedOnnxValue.CreateFromTensor(session.InputMetadata.Keys.First(), input)]);
        Tensor<float> Out(string name) => results.First(r => r.Name == name).AsTensor<float>();

        SKPoint[]? best = null;
        var bestArea = 0f;
        foreach (var stride in (int[])[8, 16, 32])
        {
            var (cls, obj, box, kps) = (Out($"cls_{stride}"), Out($"obj_{stride}"), Out($"bbox_{stride}"), Out($"kps_{stride}"));
            var cols = Side / stride;
            for (var k = 0; k < cls.Dimensions[1]; k++)
            {
                var score = MathF.Sqrt(Math.Clamp(cls[0, k, 0], 0, 1) * Math.Clamp(obj[0, k, 0], 0, 1));
                if (score < MinScore) continue;
                var area = MathF.Exp(box[0, k, 2]) * MathF.Exp(box[0, k, 3]) * stride * stride;
                if (area <= bestArea) continue;
                var (r, c) = (k / cols, k % cols);
                bestArea = area;
                best = [.. Enumerable.Range(0, 5).Select(n =>
                    new SKPoint((kps[0, k, 2 * n] + c) * stride / scale, (kps[0, k, 2 * n + 1] + r) * stride / scale))];
            }
        }
        return best;
    }

    /// SFace on the face moved onto its template by the least-squares similarity (rotation, scale and
    /// shift; what OpenCV's alignCrop estimates), RGB 0–255.
    private static float[] Embed(SKBitmap photo, SKPoint[] points)
    {
        float msx = 0, msy = 0, mdx = 0, mdy = 0;
        for (var i = 0; i < 5; i++) (msx, msy, mdx, mdy) = (msx + points[i].X / 5, msy + points[i].Y / 5, mdx + Template[i].X / 5, mdy + Template[i].Y / 5);
        float dot = 0, cross = 0, norm = 0;
        for (var i = 0; i < 5; i++)
        {
            var (sx, sy, dx, dy) = (points[i].X - msx, points[i].Y - msy, Template[i].X - mdx, Template[i].Y - mdy);
            dot += sx * dx + sy * dy;
            cross += sx * dy - sy * dx;
            norm += sx * sx + sy * sy;
        }
        var (a, b) = (dot / norm, cross / norm);
        var matrix = new SKMatrix(a, -b, mdx - (a * msx - b * msy), b, a, mdy - (b * msx + a * msy), 0, 0, 1);

        using var face = new SKBitmap(new SKImageInfo(Crop, Crop, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        using (var canvas = new SKCanvas(face))
        {
            canvas.Clear(SKColors.Black);
            canvas.SetMatrix(matrix);
            using var image = SKImage.FromBitmap(photo);
            canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Linear));
        }

        var input = new DenseTensor<float>([1, 3, Crop, Crop]);
        var px = face.GetPixelSpan();
        for (var y = 0; y < Crop; y++)
        for (var x = 0; x < Crop; x++)
        {
            var i = (y * Crop + x) * 4;
            input[0, 0, y, x] = px[i];
            input[0, 1, y, x] = px[i + 1];
            input[0, 2, y, x] = px[i + 2];
        }

        var session = Recogniser.Value;
        using var results = session.Run([NamedOnnxValue.CreateFromTensor("data", input)]);
        var raw = results.First(r => r.Name == "fc1").AsTensor<float>().ToArray();
        var length = MathF.Sqrt(raw.Sum(v => v * v));
        return [.. raw.Select(v => v / length)];
    }
}
