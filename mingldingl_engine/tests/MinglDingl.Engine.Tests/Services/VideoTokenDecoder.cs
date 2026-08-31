using System.IO.Compression;

public static class VideoTokenDecoder
{
    public static uint DecodeTtlSeconds(string token)
    {
        byte[] compressed = Convert.FromBase64String(token[3..]);
        using var compressedStream = new MemoryStream(compressed);
        using var zlib = new ZLibStream(compressedStream, CompressionMode.Decompress);
        using var content = new MemoryStream();
        zlib.CopyTo(content);
        byte[] bytes = content.ToArray();

        int pos = 0;
        ushort sigLen = ReadUInt16(bytes, ref pos);
        pos += sigLen;

        ushort appIdLen = ReadUInt16(bytes, ref pos);
        pos += appIdLen;

        pos += 4;
        return ReadUInt32(bytes, ref pos);
    }

    private static ushort ReadUInt16(byte[] b, ref int pos)
    {
        ushort v = (ushort)(b[pos] | (b[pos + 1] << 8));
        pos += 2;
        return v;
    }

    private static uint ReadUInt32(byte[] b, ref int pos)
    {
        uint v = (uint)(b[pos] | (b[pos + 1] << 8) | (b[pos + 2] << 16) | (b[pos + 3] << 24));
        pos += 4;
        return v;
    }
}
