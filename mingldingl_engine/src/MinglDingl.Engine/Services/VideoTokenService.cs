using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

public class VideoTokenService
{
    private const string Version = "007";
    private const ushort ServiceTypeRtc = 1;
    private const ushort PrivilegeJoinChannel = 1;
    private const ushort PrivilegePublishAudioStream = 2;
    private const ushort PrivilegePublishVideoStream = 3;
    private const ushort PrivilegePublishDataStream = 4;
    private const uint TokenExpireSeconds = 24 * 3600;

    public string AppId { get; }
    private readonly string _appCertificate;

    public VideoTokenService(IConfiguration config, IHostEnvironment env)
    {
        var appId = config["Agora:AppId"];
        var appCertificate = config["Agora:AppCertificate"];

        if ((string.IsNullOrEmpty(appId) || string.IsNullOrEmpty(appCertificate)) && !env.IsDevelopment())
            throw new InvalidOperationException(
                "Agora:AppId and Agora:AppCertificate must be configured outside the Development environment — refusing to fall back to dev placeholder credentials.");
        AppId = appId ?? "dev_app_id";
        _appCertificate = appCertificate ?? "dev_cert";
    }

    public string GenerateToken(Guid matchId) => GenerateToken(matchId, TokenExpireSeconds);

    public string GenerateToken(Guid matchId, uint ttlSeconds)
    {
        string channelName = matchId.ToString("N");
        string uid = "";
        uint issueTs = (uint)DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        uint salt = (uint)Random.Shared.Next(1, 99_999_999) + 1;

        var privileges = new SortedDictionary<ushort, uint>
        {
            [PrivilegeJoinChannel] = ttlSeconds,
            [PrivilegePublishAudioStream] = ttlSeconds,
            [PrivilegePublishVideoStream] = ttlSeconds,
            [PrivilegePublishDataStream] = ttlSeconds,
        };

        byte[] servicePacked = PackRtcService(channelName, uid, privileges);

        using var signingInfo = new MemoryStream();
        WriteString(signingInfo, AppId);
        WriteUInt32(signingInfo, issueTs);
        WriteUInt32(signingInfo, ttlSeconds);
        WriteUInt32(signingInfo, salt);
        WriteUInt16(signingInfo, 1);
        signingInfo.Write(servicePacked, 0, servicePacked.Length);
        byte[] signingInfoBytes = signingInfo.ToArray();

        byte[] appCertBytes = Encoding.UTF8.GetBytes(_appCertificate);
        byte[] signingKey1 = ComputeHmacSha256(WriteUInt32Bytes(issueTs), appCertBytes);
        byte[] signingKey2 = ComputeHmacSha256(WriteUInt32Bytes(salt), signingKey1);
        byte[] signature = ComputeHmacSha256(signingKey2, signingInfoBytes);

        using var content = new MemoryStream();
        WriteBytes(content, signature);
        content.Write(signingInfoBytes, 0, signingInfoBytes.Length);

        byte[] compressed = ZlibCompress(content.ToArray());
        return Version + Convert.ToBase64String(compressed);
    }

    private static byte[] PackRtcService(string channelName, string uid, SortedDictionary<ushort, uint> privileges)
    {
        using var ms = new MemoryStream();
        WriteUInt16(ms, ServiceTypeRtc);
        WriteUInt16(ms, (ushort)privileges.Count);
        foreach (var (key, value) in privileges)
        {
            WriteUInt16(ms, key);
            WriteUInt32(ms, value);
        }
        WriteString(ms, channelName);
        WriteString(ms, uid);
        return ms.ToArray();
    }

    private static void WriteString(Stream s, string v) => WriteBytes(s, Encoding.UTF8.GetBytes(v));

    private static void WriteBytes(Stream s, byte[] b)
    {
        WriteUInt16(s, (ushort)b.Length);
        s.Write(b, 0, b.Length);
    }

    private static void WriteUInt16(Stream s, ushort v)
    {
        s.WriteByte((byte)(v & 0xFF));
        s.WriteByte((byte)((v >> 8) & 0xFF));
    }

    private static void WriteUInt32(Stream s, uint v)
    {
        s.WriteByte((byte)(v & 0xFF));
        s.WriteByte((byte)((v >> 8) & 0xFF));
        s.WriteByte((byte)((v >> 16) & 0xFF));
        s.WriteByte((byte)((v >> 24) & 0xFF));
    }

    private static byte[] WriteUInt32Bytes(uint v) => [
        (byte)(v & 0xFF), (byte)((v >> 8) & 0xFF), (byte)((v >> 16) & 0xFF), (byte)((v >> 24) & 0xFF)
    ];

    private static byte[] ComputeHmacSha256(byte[] key, byte[] data)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(data);
    }

    private static byte[] ZlibCompress(byte[] data)
    {
        using var output = new MemoryStream();
        using (var zlib = new ZLibStream(output, CompressionLevel.Optimal, leaveOpen: true))
        {
            zlib.Write(data, 0, data.Length);
        }
        return output.ToArray();
    }
}
