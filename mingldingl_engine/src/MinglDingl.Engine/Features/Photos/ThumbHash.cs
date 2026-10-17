namespace MinglDingl.Engine.Features.Photos;

/// Port of the reference encoder (github.com/evanw/thumbhash, MIT): a ~25-byte placeholder the
/// device renders as a blur. A sealed photo is sent only as this — the image never leaves the engine.
public static class ThumbHash
{
    public static byte[] FromRgba(int w, int h, ReadOnlySpan<byte> rgba)
    {
        if (w > 100 || h > 100) throw new ArgumentException($"{w}x{h} doesn't fit in 100x100");
        if (rgba.Length != w * h * 4) throw new ArgumentException("rgba length must be w*h*4");

        double avgR = 0, avgG = 0, avgB = 0, avgA = 0;
        for (int i = 0, j = 0; i < w * h; i++, j += 4)
        {
            var alpha = rgba[j + 3] / 255.0;
            avgR += alpha / 255.0 * rgba[j];
            avgG += alpha / 255.0 * rgba[j + 1];
            avgB += alpha / 255.0 * rgba[j + 2];
            avgA += alpha;
        }
        if (avgA > 0) { avgR /= avgA; avgG /= avgA; avgB /= avgA; }

        var hasAlpha = avgA < w * h;
        var lLimit = hasAlpha ? 5 : 7;
        var lx = Math.Max(1, Round(lLimit * w / (double)Math.Max(w, h)));
        var ly = Math.Max(1, Round(lLimit * h / (double)Math.Max(w, h)));
        var l = new double[w * h];
        var p = new double[w * h];
        var q = new double[w * h];
        var a = new double[w * h];

        for (int i = 0, j = 0; i < w * h; i++, j += 4)
        {
            var alpha = rgba[j + 3] / 255.0;
            var r = avgR * (1 - alpha) + alpha / 255.0 * rgba[j];
            var g = avgG * (1 - alpha) + alpha / 255.0 * rgba[j + 1];
            var b = avgB * (1 - alpha) + alpha / 255.0 * rgba[j + 2];
            l[i] = (r + g + b) / 3;
            p[i] = (r + g) / 2 - b;
            q[i] = r - g;
            a[i] = alpha;
        }

        var (lDc, lAc, lScale) = Encode(l, Math.Max(3, lx), Math.Max(3, ly), w, h);
        var (pDc, pAc, pScale) = Encode(p, 3, 3, w, h);
        var (qDc, qAc, qScale) = Encode(q, 3, 3, w, h);
        var (aDc, aAc, aScale) = hasAlpha ? Encode(a, 5, 5, w, h) : (0, [], 0);

        var isLandscape = w > h;
        var header24 = Round(63 * lDc) | (Round(31.5 + 31.5 * pDc) << 6) | (Round(31.5 + 31.5 * qDc) << 12)
                       | (Round(31 * lScale) << 18) | ((hasAlpha ? 1 : 0) << 23);
        var header16 = (isLandscape ? ly : lx) | (Round(63 * pScale) << 3) | (Round(63 * qScale) << 9) | ((isLandscape ? 1 : 0) << 15);

        var acs = hasAlpha ? new[] { lAc, pAc, qAc, aAc } : new[] { lAc, pAc, qAc };
        var acStart = hasAlpha ? 6 : 5;
        var acCount = acs.Sum(x => x.Count);
        var hash = new byte[acStart + (acCount + 1) / 2];
        hash[0] = (byte)(header24 & 255);
        hash[1] = (byte)((header24 >> 8) & 255);
        hash[2] = (byte)(header24 >> 16);
        hash[3] = (byte)(header16 & 255);
        hash[4] = (byte)(header16 >> 8);
        if (hasAlpha) hash[5] = (byte)(Round(15 * aDc) | (Round(15 * aScale) << 4));

        var acIndex = 0;
        foreach (var ac in acs)
        foreach (var f in ac)
        {
            hash[acStart + (acIndex >> 1)] |= (byte)(Round(15 * f) << ((acIndex & 1) << 2));
            acIndex++;
        }
        return hash;
    }

    private static (double Dc, List<double> Ac, double Scale) Encode(double[] channel, int nx, int ny, int w, int h)
    {
        double dc = 0, scale = 0;
        var ac = new List<double>();
        var fx = new double[w];
        for (var cy = 0; cy < ny; cy++)
        for (var cx = 0; cx * ny < nx * (ny - cy); cx++)
        {
            double f = 0;
            for (var x = 0; x < w; x++) fx[x] = Math.Cos(Math.PI / w * cx * (x + 0.5));
            for (var y = 0; y < h; y++)
            {
                var fy = Math.Cos(Math.PI / h * cy * (y + 0.5));
                for (var x = 0; x < w; x++) f += channel[x + y * w] * fx[x] * fy;
            }
            f /= w * h;
            if (cx > 0 || cy > 0)
            {
                ac.Add(f);
                scale = Math.Max(scale, Math.Abs(f));
            }
            else dc = f;
        }
        if (scale > 0)
            for (var i = 0; i < ac.Count; i++) ac[i] = 0.5 + 0.5 / scale * ac[i];
        return (dc, ac, scale);
    }

    /// JavaScript's Math.round (halves go up), which the reference uses.
    private static int Round(double x) => (int)Math.Floor(x + 0.5);
}
