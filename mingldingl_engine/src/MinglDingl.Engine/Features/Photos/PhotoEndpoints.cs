using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Errors;

namespace MinglDingl.Engine.Features.Photos;

public sealed class PhotoEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me/photos").WithTags("Photos");

        g.MapGet("", (ClaimsPrincipal u, PhotoService svc, CancellationToken ct) => svc.ListAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("ListMyPhotos");

        g.MapPost("", async (IFormFile? file, [FromHeader(Name = "Idempotency-Key")] string? key,
                ClaimsPrincipal u, PhotoService svc, CancellationToken ct) =>
            {
                if (file is null) throw new DomainException(400, "photos.not_image", "Attach a photo");
                if (file.Length > PhotoService.MaxUploadBytes) throw new DomainException(400, "photos.too_large", "That photo is too large");
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct);
                return await svc.UploadAsync(u.AccountId(), ms.ToArray(), key, ct);
            })
            .AsWrite().DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(PhotoService.MaxUploadBytes + 64 * 1024))
            .Accepts<IFormFile>("multipart/form-data").WithName("UploadPhoto");

        var face = app.MapGroup("/me/face").WithTags("Photos");

        face.MapGet("", (ClaimsPrincipal u, FaceProofService svc, CancellationToken ct) => svc.StatusAsync(u.AccountId(), ct))
            .RequireAuthorization().WithName("GetFaceProof");

        face.MapPost("", async (HttpRequest req, ClaimsPrincipal u, FaceProofService svc, CancellationToken ct) =>
            {
                var form = await req.ReadFormAsync(ct);
                var straight = form.Files.GetFile("straight");
                var turned = form.Files.GetFiles("turned");
                if (straight is null || turned.Count == 0) throw new DomainException(400, "photos.not_image", "Attach both selfies");
                if (turned.Count > FaceProofService.MaxTurned) throw new DomainException(400, "photos.too_many", "Too many selfies");
                if (straight.Length > PhotoService.MaxUploadBytes || turned.Any(t => t.Length > PhotoService.MaxUploadBytes))
                    throw new DomainException(400, "photos.too_large", "That photo is too large");
                var turnedBytes = new List<byte[]>();
                foreach (var t in turned) turnedBytes.Add(await Bytes(t, ct));
                return await svc.CheckAsync(u.AccountId(), await Bytes(straight, ct), turnedBytes, ct);
            })
            .AsWrite().DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute((1 + FaceProofService.MaxTurned) * PhotoService.MaxUploadBytes + 64 * 1024))
            .Accepts<FaceProofUpload>("multipart/form-data").WithName("ProveFace");

        g.MapPut("/order", (ReorderRequest req, ClaimsPrincipal u, PhotoService svc, CancellationToken ct) =>
            svc.ReorderAsync(u.AccountId(), req.Ids, ct)).AsWrite().WithName("ReorderPhotos");

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal u, PhotoService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(u.AccountId(), id, ct);
            return Results.NoContent();
        }).AsWrite().WithName("DeletePhoto");
    }

    private static async Task<byte[]> Bytes(IFormFile file, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return ms.ToArray();
    }
}

/// The selfies of a face check, as form parts: one straight, and one to four taken while the head
/// turns (the app shoots through the turn, since a person turns at their own pace).
public sealed record FaceProofUpload(IFormFile Straight, IFormFile[] Turned);
