using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SkiaSharp;

namespace MinglDingl.Engine.Features.Photos;

/// Whether a portrait shows a human face: Ultra-Light-Fast-Generic-Face-Detector RFB-320 (MIT,
/// `Models/ultraface-rfb-320.onnx`, 1.2 MB) on the CPU. It answers yes or no and keeps nothing —
/// no face data is stored. Group photos pass; drawings, animals, objects and empty places do not.
/// A face far off is found too, so a place with people in the background also passes — at that size
/// a stranger behind and a person standing far off look the same to it (a refused honest full-body
/// photo was judged worse).
public static class FaceFinder
{
    private const int W = 320, H = 240;
    /// A face must be this sure, and at least this share of the photo's shorter side.
    private const float MinScore = 0.8f, MinSide = 0.06f;

    /// One core a check, and at most two checks at once: uploads can never take more than 2 of the
    /// server's 8 threads, whatever arrives together (the rest wait their turn).
    private static readonly Lazy<InferenceSession> Session = new(() =>
        new InferenceSession(Path.Combine(AppContext.BaseDirectory, "Models", "ultraface-rfb-320.onnx"),
            new Microsoft.ML.OnnxRuntime.SessionOptions { IntraOpNumThreads = 1, InterOpNumThreads = 1, ExecutionMode = ExecutionMode.ORT_SEQUENTIAL }));
    private static readonly SemaphoreSlim Turns = new(2);

    /// Pieces as a share of the photo's width: the whole photo first, then — only when nothing is
    /// found — overlapping 4:3 pieces at about 3× the size, so a person standing well off (a face
    /// down to ~2% of the photo's height) is still found. A photo with a face stops at the first hit
    /// (~30 ms on one core); one with none costs ~180 ms. A 5× pass (0.35) was tried on 2026-10-21:
    /// it found faces down to ~1.2% — 2 px in the app's tile — for ~590 ms, and let twice the
    /// crowded scenery through, so it was left out.
    private static readonly float[] Zooms = [0.6f];

    public static bool HasFace(SKBitmap photo)
    {
        Turns.Wait();
        try
        {
            if (Find(photo, SKRectI.Create(photo.Width, photo.Height), MinSide)) return true;
            foreach (var zoom in Zooms)
            foreach (var piece in Pieces(photo.Width, photo.Height, zoom))
                if (Find(photo, piece, PieceMinSide)) return true;
            return false;
        }
        finally
        {
            Turns.Release();
        }
    }

    /// In a piece a face must still be this share of the piece's shorter side.
    private const float PieceMinSide = 0.05f;

    private static IEnumerable<SKRectI> Pieces(int pw, int ph, float zoom)
    {
        var tw = pw * zoom;
        var th = tw * H / W;
        if (th > ph) (th, tw) = (ph * zoom, ph * zoom * W / H);
        foreach (var y in Steps(ph, th))
        foreach (var x in Steps(pw, tw))
            yield return SKRectI.Create((int)x, (int)y, (int)tw, (int)th);
    }

    /// Starts along one side so neighbouring pieces overlap by at least 40%.
    private static IEnumerable<float> Steps(float length, float size)
    {
        var n = (int)Math.Ceiling((length - size) / (size * 0.6f)) + 1;
        for (var i = 0; i < n; i++) yield return n == 1 ? 0 : (length - size) * i / (n - 1);
    }

    private static bool Find(SKBitmap photo, SKRectI area, float minShare)
    {
        // Letterboxed into the model's 320×240, so a tall portrait's face keeps its shape.
        var scale = Math.Min(W / (float)area.Width, H / (float)area.Height);
        var w = Math.Max(1, (int)(area.Width * scale));
        var h = Math.Max(1, (int)(area.Height * scale));
        var (ox, oy) = ((W - w) / 2, (H - h) / 2);
        using var frame = new SKBitmap(new SKImageInfo(W, H, SKColorType.Rgba8888, SKAlphaType.Unpremul));
        using (var canvas = new SKCanvas(frame))
        {
            canvas.Clear(SKColors.Black);
            using var image = SKImage.FromBitmap(photo);
            canvas.DrawImage(image, area, SKRect.Create(ox, oy, w, h), new SKSamplingOptions(SKFilterMode.Linear));
        }

        var input = new DenseTensor<float>([1, 3, H, W]);
        var px = frame.GetPixelSpan();
        for (var y = 0; y < H; y++)
        for (var x = 0; x < W; x++)
        {
            var i = (y * W + x) * 4;
            input[0, 0, y, x] = (px[i] - 127f) / 128f;
            input[0, 1, y, x] = (px[i + 1] - 127f) / 128f;
            input[0, 2, y, x] = (px[i + 2] - 127f) / 128f;
        }

        var session = Session.Value;
        using var results = session.Run([NamedOnnxValue.CreateFromTensor(session.InputMetadata.Keys.First(), input)]);
        var scores = results.First(r => r.Name == "scores").AsTensor<float>();
        var boxes = results.First(r => r.Name == "boxes").AsTensor<float>();
        var minSide = minShare * Math.Min(w, h);
        for (var k = 0; k < scores.Dimensions[1]; k++)
        {
            if (scores[0, k, 1] < MinScore) continue;
            var bw = (boxes[0, k, 2] - boxes[0, k, 0]) * W;
            var bh = (boxes[0, k, 3] - boxes[0, k, 1]) * H;
            if (Math.Min(bw, bh) >= minSide) return true;
        }
        return false;
    }
}
