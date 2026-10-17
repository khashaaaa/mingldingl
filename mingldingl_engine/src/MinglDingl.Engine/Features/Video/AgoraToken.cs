using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace MinglDingl.Engine.Features.Video;

/// Agora's AccessToken2 ("007…") for one RTC channel: join and publish audio / video / data, all
/// for `expireSeconds`. Same bytes as Agora's reference builders: little-endian fields, an
/// HMAC-SHA256 signature keyed by the certificate through the issue time and the salt, zlib, base64.
public static class AgoraToken
{
    private const ushort ServiceRtc = 1;
    private static readonly ushort[] Privileges = [1, 2, 3, 4]; // join, publish audio, video, data

    public static string BuildRtc(string appId, string appCertificate, string channel, uint uid, uint expireSeconds,
        uint? issuedAt = null, uint? salt = null)
    {
        var ts = issuedAt ?? (uint)DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var s = salt ?? (uint)RandomNumberGenerator.GetInt32(1, 99_999_999);

        var data = new MemoryStream();
        PackString(data, Encoding.UTF8.GetBytes(appId));
        PackUInt32(data, ts);
        PackUInt32(data, expireSeconds);
        PackUInt32(data, s);
        PackUInt16(data, 1); // one service
        PackUInt16(data, ServiceRtc);
        PackUInt16(data, (ushort)Privileges.Length);
        foreach (var p in Privileges)
        {
            PackUInt16(data, p);
            PackUInt32(data, expireSeconds);
        }
        PackString(data, Encoding.UTF8.GetBytes(channel));
        PackString(data, Encoding.UTF8.GetBytes(uid == 0 ? "" : uid.ToString()));

        var signing = HMACSHA256.HashData(LE32(s), HMACSHA256.HashData(LE32(ts), Encoding.UTF8.GetBytes(appCertificate)));
        var signature = HMACSHA256.HashData(signing, data.ToArray());

        var content = new MemoryStream();
        PackString(content, signature);
        data.Position = 0;
        data.CopyTo(content);

        var zipped = new MemoryStream();
        using (var z = new ZLibStream(zipped, CompressionLevel.Optimal, leaveOpen: true)) z.Write(content.ToArray());
        return "007" + Convert.ToBase64String(zipped.ToArray());
    }

    /// The fields back out of a token (tests, and the dev log line).
    public static (byte[] Signature, string AppId, uint IssuedAt, uint Expire, uint Salt, string Channel, string Uid, byte[] Signed)
        Read(string token)
    {
        if (!token.StartsWith("007")) throw new FormatException("Not an AccessToken2");
        using var z = new ZLibStream(new MemoryStream(Convert.FromBase64String(token[3..])), CompressionMode.Decompress);
        var all = new MemoryStream();
        z.CopyTo(all);
        var bytes = all.ToArray();
        var i = 0;
        var sig = Str(bytes, ref i);
        var signedFrom = i;
        var appId = Encoding.UTF8.GetString(Str(bytes, ref i));
        var ts = U32(bytes, ref i);
        var expire = U32(bytes, ref i);
        var salt = U32(bytes, ref i);
        var services = U16(bytes, ref i);
        string channel = "", uid = "";
        for (var n = 0; n < services; n++)
        {
            U16(bytes, ref i);
            var privileges = U16(bytes, ref i);
            i += privileges * 6;
            channel = Encoding.UTF8.GetString(Str(bytes, ref i));
            uid = Encoding.UTF8.GetString(Str(bytes, ref i));
        }
        return (sig, appId, ts, expire, salt, channel, uid, bytes[signedFrom..]);
    }

    public static byte[] Sign(string appCertificate, uint issuedAt, uint salt, byte[] signed) =>
        HMACSHA256.HashData(HMACSHA256.HashData(LE32(salt), HMACSHA256.HashData(LE32(issuedAt), Encoding.UTF8.GetBytes(appCertificate))), signed);

    private static byte[] LE32(uint v)
    {
        var b = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(b, v);
        return b;
    }

    private static void PackUInt16(Stream s, ushort v)
    {
        Span<byte> b = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16LittleEndian(b, v);
        s.Write(b);
    }

    private static void PackUInt32(Stream s, uint v) => s.Write(LE32(v));

    private static void PackString(Stream s, byte[] v)
    {
        PackUInt16(s, (ushort)v.Length);
        s.Write(v);
    }

    private static ushort U16(byte[] b, ref int i)
    {
        var v = BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
        i += 2;
        return v;
    }

    private static uint U32(byte[] b, ref int i)
    {
        var v = BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
        i += 4;
        return v;
    }

    private static byte[] Str(byte[] b, ref int i)
    {
        var n = U16(b, ref i);
        var v = b[i..(i + n)];
        i += n;
        return v;
    }
}
