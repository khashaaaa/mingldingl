using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Errors;

namespace MinglDingl.Engine.Features.Venues;

public sealed class VenueEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/venues").WithTags("Venues");
        g.MapGet("", (Guid? bond, ClaimsPrincipal u, VenueService svc, CancellationToken ct) => svc.ListForAsync(u.AccountId(), bond, ct))
            .RequireAuthorization().WithName("ListVenues");
        g.MapGet("/{id:guid}", (Guid id, VenueService svc, CancellationToken ct) => svc.GetAsync(id, ct))
            .RequireAuthorization().WithName("GetVenue");

        var a = app.MapGroup("/admin/venues").WithTags("Admin").RequireAuthorization(AdminEndpoints.Policy);
        a.MapGet("", (VenueService svc, CancellationToken ct) => svc.AdminListAsync(ct)).WithName("AdminListVenues");
        a.MapGet("/{id:guid}", (Guid id, VenueService svc, CancellationToken ct) => svc.AdminGetAsync(id, ct)).WithName("AdminGetVenue");
        a.MapPost("", (VenueWriteRequest req, VenueService svc, CancellationToken ct) => svc.CreateAsync(req, ct)).WithName("AdminCreateVenue");
        a.MapPut("/{id:guid}", (Guid id, VenueWriteRequest req, VenueService svc, CancellationToken ct) => svc.UpdateAsync(id, req, ct))
            .WithName("AdminUpdateVenue");
        a.MapDelete("/{id:guid}", async (Guid id, VenueService svc, CancellationToken ct) =>
        {
            await svc.RemoveAsync(id, ct);
            return Results.NoContent();
        }).WithName("AdminRemoveVenue");
        a.MapPost("/{id:guid}/photos", async (Guid id, IFormFile? file, VenueService svc, CancellationToken ct) =>
            {
                if (file is null) throw new DomainException(400, "photos.not_image", "Attach a photo");
                if (file.Length > PhotoService.MaxUploadBytes) throw new DomainException(400, "photos.too_large", "That photo is too large");
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct);
                return await svc.AddPhotoAsync(id, ms.ToArray(), ct);
            })
            .DisableAntiforgery()
            .WithMetadata(new RequestSizeLimitAttribute(PhotoService.MaxUploadBytes + 64 * 1024))
            .Accepts<IFormFile>("multipart/form-data").WithName("AdminAddVenuePhoto");
        a.MapDelete("/{id:guid}/photos/{photoId:guid}", (Guid id, Guid photoId, VenueService svc, CancellationToken ct) =>
            svc.RemovePhotoAsync(id, photoId, ct)).WithName("AdminRemoveVenuePhoto");
    }
}
