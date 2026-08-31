public record BusinessResponse(
    Guid Id,
    string Name,
    string Category,
    string City,
    string District,
    string Description,
    List<string> PhotoUrls,
    string OperatingHours,
    bool IsVerified,
    bool IsFeatured,
    decimal AverageRating,
    int RatingCount);

public record RateBusinessRequest(int Stars, string? Review, string? PhotoUrl = null);

public record RateBusinessResponse(decimal AverageRating, int RatingCount);

public record BusinessRatingAggregate(decimal AverageRating, int RatingCount);

public record BusinessReviewResponse(int Stars, string? Review, string? PhotoUrl, DateTime CreatedAt);
