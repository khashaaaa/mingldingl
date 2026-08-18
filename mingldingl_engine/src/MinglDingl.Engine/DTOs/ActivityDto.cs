public record BusinessSummary(Guid Id, string Name, decimal AverageRating, string District, string? Photo);

// MyConfirmed / IsComplete / MyRated let the client render "already
// pledged" / "both confirmed" / "already rated" state straight from this
// fetch, rather than relying on a mutation's local result that's gone the
// moment the screen remounts (re-rating then hits BusinessController.Rate's
// 409, since a match can only be rated once per BusinessRatings' unique
// (BusinessPartnerId, UserId, MatchId) index).
public record ActivitySuggestionResponse(Guid Id, string ActivityType, string Title, BusinessSummary? Business, bool MyConfirmed, bool IsComplete, bool MyRated);

// Awarded is the calling user's own real total for this call — 0 unless
// this confirmation is the one that completes the pair.
public record ConfirmDateResponse(bool InitiatorConfirmed, bool ReceiverConfirmed, bool IsComplete, int Awarded = 0);

// A keepsake, not a bare history row — MyStars/MyMomentPhotoUrl surface the
// caller's own rating (given via ActivitiesScreen's rate-your-date flow) if
// they left one, null if they never rated this date.
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

// Attended is the caller's own recorded attendance value — never the other
// participant's, and never whether a mismatch/penalty resulted (that's
// deliberately invisible client-side, see the No-Show Tracking spec's
// anti-abuse section).
public record AttendanceCheckResponse(bool Attended);
