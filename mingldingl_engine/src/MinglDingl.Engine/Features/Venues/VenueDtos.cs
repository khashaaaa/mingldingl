using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Venues;

public sealed record VenuePhotoView(Guid Id, string Url, DateTimeOffset ExpiresAt, string ThumbHash, int Width, int Height);

/// A place as a traveller sees it. rating: the mean stars from kept meetings (null with none).
/// gone: the keepers removed it (a meeting that points here must choose again).
public sealed record VenueView(
    Guid Id, string Name, string? NameMn, string Kind, string District, string Address, string? Hours, string? Description,
    string? AddressMn, string? HoursMn, string? DescriptionMn, double? Rating, int Ratings, IReadOnlyList<VenuePhotoView> Photos, bool Gone);

/// A place as the keepers see it.
public sealed record AdminVenueView(
    Guid Id, string Name, string? NameMn, string Kind, string District, string Address, string? Hours, string? Description,
    string? AddressMn, string? HoursMn, string? DescriptionMn, bool Verified, bool Removed, double? Rating, int Ratings, IReadOnlyList<VenuePhotoView> Photos, DateTimeOffset CreatedAt);

public sealed record VenueWriteRequest(
    [Required, StringLength(FieldLimits.VenueName)] string Name,
    [StringLength(FieldLimits.VenueName)] string? NameMn,
    [Required, StringLength(20)] string Kind,
    [Required, StringLength(40)] string District,
    [Required, StringLength(FieldLimits.VenueAddress)] string Address,
    [StringLength(FieldLimits.VenueHours)] string? Hours,
    [StringLength(FieldLimits.VenueDescription)] string? Description,
    bool Verified,
    [StringLength(FieldLimits.VenueAddress)] string? AddressMn = null,
    [StringLength(FieldLimits.VenueHours)] string? HoursMn = null,
    [StringLength(FieldLimits.VenueDescription)] string? DescriptionMn = null);
