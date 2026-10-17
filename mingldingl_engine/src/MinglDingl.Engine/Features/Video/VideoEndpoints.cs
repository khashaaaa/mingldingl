using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Video;

public sealed record RiteAnswerRequest(bool Accept);

public sealed class VideoEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/bonds/{id:guid}/rite").WithTags("Video");
        g.MapPost("", (Guid id, ClaimsPrincipal u, VideoService svc, CancellationToken ct) => svc.ProposeAsync(u.AccountId(), id, ct))
            .AsWrite().WithName("ProposeRite");
        g.MapPost("/answer", (Guid id, RiteAnswerRequest req, ClaimsPrincipal u, VideoService svc, CancellationToken ct) =>
            svc.AnswerAsync(u.AccountId(), id, req.Accept, ct)).AsWrite().WithName("AnswerRite");
        g.MapPost("/call", (Guid id, ClaimsPrincipal u, VideoService svc, CancellationToken ct) => svc.StartAsync(u.AccountId(), id, ct))
            .AsWrite().WithName("StartCall");
        g.MapPost("/douse", (Guid id, ClaimsPrincipal u, VideoService svc, CancellationToken ct) => svc.DouseAsync(u.AccountId(), id, ct))
            .AsWrite().WithName("DouseCall");

        app.MapPost("/video/calls/{callId:guid}/presence", async (Guid callId, PresenceRequest req, ClaimsPrincipal u, VideoService svc, CancellationToken ct) =>
        {
            await svc.DevPresenceAsync(u.AccountId(), callId, req.Joined, ct);
            return Results.NoContent();
        }).WithTags("Video").RequireAuthorization().WithName("ReportPresence");

        // Agora's Notification Center: channel joins and leaves, signed with the NCS secret.
        app.MapPost("/video/ncs", async (HttpRequest http, VideoService svc, AgoraSettings agora, ILogger<VideoEndpoints> log, CancellationToken ct) =>
        {
            using var reader = new StreamReader(http.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync(ct);
            if (string.IsNullOrEmpty(agora.NcsSecret) || !Signed(body, http.Headers["Agora-Signature-V2"].ToString(), agora.NcsSecret))
                return Results.Unauthorized();
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                var type = root.GetProperty("eventType").GetInt32();
                if (type is not (103 or 104 or 105 or 106)) return Results.Ok();
                var p = root.GetProperty("payload");
                var at = DateTimeOffset.FromUnixTimeSeconds(p.GetProperty("ts").GetInt64());
                await svc.PresenceAsync(p.GetProperty("channelName").GetString() ?? "", p.GetProperty("uid").GetUInt32(),
                    type is 103 or 105, at, ct);
            }
            catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
            {
                log.LogWarning(e, "Unreadable Agora notice");
            }
            return Results.Ok();
        }).WithTags("Video").AllowAnonymous().ExcludeFromDescription();
    }

    public static bool Signed(string body, string header, string secret)
    {
        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body)));
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(header.Trim().ToLowerInvariant()));
    }
}
