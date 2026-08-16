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

// Shape for the atomic RETURNING clause in BusinessController.Rate — column names
// must match "AverageRating"/"RatingCount" for Database.SqlQuery<T> to bind them.
public record BusinessRatingAggregate(decimal AverageRating, int RatingCount);

// Anonymous by design — this is a "what happened here" wall for people
// browsing the business, not a way to look up who went on a date with whom.
public record BusinessReviewResponse(int Stars, string? Review, string? PhotoUrl, DateTime CreatedAt);
