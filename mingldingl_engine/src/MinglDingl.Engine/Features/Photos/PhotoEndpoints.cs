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

        face.MapPost("", async (IFormFile? straight, IFormFile? turned, ClaimsPrincipal u, FaceProofService svc, CancellationToken ct) =>
            {
                if (straight is null || turned is null) throw new DomainException(400, "photos.not_image", "Attach both selfies");
                if (straight.Length > PhotoService.MaxUploadBytes || turned.Length > PhotoService.MaxUploadBytes)
                    throw new DomainException(400, "photos.too_large", "That photo is too large");
                return await svc.CheckAsync(u.AccountId(), await Bytes(straight, ct), await Bytes(turned, ct), ct);
            })
            .AsWrite().DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(2 * PhotoService.MaxUploadBytes + 64 * 1024))
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

/// The two selfies of a face check, as form parts.
public sealed record FaceProofUpload(IFormFile Straight, IFormFile Turned);
