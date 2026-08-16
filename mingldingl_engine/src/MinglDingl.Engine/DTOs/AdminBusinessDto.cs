public record AdminCreateBusinessRequest(
    string Name,
    string Category,
    string City,
    string District,
    string Description,
    List<string> PhotoUrls,
    string OperatingHours,
    bool IsVerified,
    bool IsFeatured);

public record AdminBulkUpdateBusinessRequest(List<Guid> Ids, bool? IsVerified, bool? IsFeatured);

public record AdminUpdateBusinessRequest(
    string Name,
    string Category,
    string City,
    string District,
    string Description,
    List<string> PhotoUrls,
    string OperatingHours,
    bool IsVerified,
    bool IsFeatured);
