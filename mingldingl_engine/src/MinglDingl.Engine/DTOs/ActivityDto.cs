public record BusinessSummary(Guid Id, string Name, decimal AverageRating, string District, string? Photo);

public record ActivitySuggestionResponse(Guid Id, string ActivityType, string Title, BusinessSummary? Business, bool MyConfirmed, bool IsComplete, bool MyRated);

public record ConfirmDateResponse(bool InitiatorConfirmed, bool ReceiverConfirmed, bool IsComplete, int Awarded = 0);

public record TrophyResponse(
    Guid MatchId,
    string ActivityTitle,
    string? BusinessName,
    string? BusinessPhoto,
    DateTime ConfirmedAt,
    int? MyStars,
    string? MyMomentPhotoUrl,
    bool Mismatched = false);

public record AttendanceCheckStatusResponse(bool Due, string? ActivityTitle);

public record AttendanceCheckRequestDto(bool Attended);

public record AttendanceCheckResponse(bool Attended);
