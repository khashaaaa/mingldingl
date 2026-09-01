using System.ComponentModel.DataAnnotations;

public record AdminCreateBusinessRequest(
    [Required, MaxLength(FieldLimits.Title)] string Name,
    [Required, MaxLength(FieldLimits.ShortLabel)] string Category,
    [Required, MaxLength(FieldLimits.ShortLabel)] string City,
    [MaxLength(FieldLimits.ShortLabel)] string District,
    [MaxLength(FieldLimits.Bio)] string Description,
    [MaxLength(FieldLimits.MaxPhotos)] List<string> PhotoUrls,
    [MaxLength(FieldLimits.ShortLabel)] string OperatingHours,
    bool IsVerified,
    bool IsFeatured);

public record AdminBulkUpdateBusinessRequest(List<Guid> Ids, bool? IsVerified, bool? IsFeatured);

public record AdminUpdateBusinessRequest(
    [Required, MaxLength(FieldLimits.Title)] string Name,
    [Required, MaxLength(FieldLimits.ShortLabel)] string Category,
    [Required, MaxLength(FieldLimits.ShortLabel)] string City,
    [MaxLength(FieldLimits.ShortLabel)] string District,
    [MaxLength(FieldLimits.Bio)] string Description,
    [MaxLength(FieldLimits.MaxPhotos)] List<string> PhotoUrls,
    [MaxLength(FieldLimits.ShortLabel)] string OperatingHours,
    bool IsVerified,
    bool IsFeatured);
